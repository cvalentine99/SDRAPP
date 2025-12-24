/**
 * iq_recorder.cpp - IQ Sample Recording Daemon
 * 
 * Records raw IQ samples from Ettus B210 to file for offline analysis.
 * Supports configurable duration, sample rate, and frequency.
 * 
 * Usage:
 *   ./iq_recorder --freq 915e6 --rate 10e6 --gain 50 --duration 10 --output recording.dat
 * 
 * Output format: Complex float32 (I/Q interleaved)
 */

#include <uhd/usrp/multi_usrp.hpp>
#include <uhd/utils/safe_main.hpp>
#include <uhd/utils/thread.hpp>
#include <boost/program_options.hpp>
#include <boost/format.hpp>
#include <iostream>
#include <fstream>
#include <csignal>
#include <complex>
#include <vector>

namespace po = boost::program_options;

static bool stop_signal_called = false;
void sig_int_handler(int) {
    stop_signal_called = true;
}

int UHD_SAFE_MAIN(int argc, char *argv[]) {
    // Set thread priority
    uhd::set_thread_priority_safe();

    // Command line options
    std::string device_args, output_file;
    double freq, rate, gain, duration;
    size_t buffer_size;

    po::options_description desc("IQ Recorder Options");
    desc.add_options()
        ("help", "Show help message")
        ("args", po::value<std::string>(&device_args)->default_value(""), "UHD device args")
        ("freq", po::value<double>(&freq)->default_value(915e6), "Center frequency (Hz)")
        ("rate", po::value<double>(&rate)->default_value(10e6), "Sample rate (Hz)")
        ("gain", po::value<double>(&gain)->default_value(50), "RX gain (dB)")
        ("duration", po::value<double>(&duration)->default_value(10.0), "Recording duration (seconds)")
        ("output", po::value<std::string>(&output_file)->default_value("recording.dat"), "Output file path")
        ("buffer", po::value<size_t>(&buffer_size)->default_value(8192), "Buffer size (samples)")
    ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);

    if (vm.count("help")) {
        std::cout << desc << std::endl;
        return EXIT_SUCCESS;
    }

    std::cout << "[IQ Recorder] Starting..." << std::endl;
    std::cout << "  Frequency: " << freq / 1e6 << " MHz" << std::endl;
    std::cout << "  Sample Rate: " << rate / 1e6 << " MSPS" << std::endl;
    std::cout << "  RX Gain: " << gain << " dB" << std::endl;
    std::cout << "  Duration: " << duration << " seconds" << std::endl;
    std::cout << "  Output: " << output_file << std::endl;

    // Create USRP device
    std::cout << "[IQ Recorder] Creating USRP device..." << std::endl;
    uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make(device_args);

    // Set sample rate
    usrp->set_rx_rate(rate);
    double actual_rate = usrp->get_rx_rate();
    std::cout << "[IQ Recorder] Actual sample rate: " << actual_rate / 1e6 << " MSPS" << std::endl;

    // Set center frequency
    uhd::tune_request_t tune_request(freq);
    usrp->set_rx_freq(tune_request);
    double actual_freq = usrp->get_rx_freq();
    std::cout << "[IQ Recorder] Actual frequency: " << actual_freq / 1e6 << " MHz" << std::endl;

    // Set RX gain
    usrp->set_rx_gain(gain);
    double actual_gain = usrp->get_rx_gain();
    std::cout << "[IQ Recorder] Actual RX gain: " << actual_gain << " dB" << std::endl;

    // Set antenna
    usrp->set_rx_antenna("TX/RX");

    // Allow time for device to settle
    std::this_thread::sleep_for(std::chrono::seconds(1));

    // Create RX streamer
    uhd::stream_args_t stream_args("fc32", "sc16");
    uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);

    // Open output file
    std::ofstream outfile(output_file, std::ios::binary);
    if (!outfile.is_open()) {
        std::cerr << "[IQ Recorder] ERROR: Failed to open output file: " << output_file << std::endl;
        return EXIT_FAILURE;
    }

    // Setup streaming
    uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
    stream_cmd.stream_now = true;
    rx_stream->issue_stream_cmd(stream_cmd);

    // Allocate buffer
    std::vector<std::complex<float>> buffer(buffer_size);
    uhd::rx_metadata_t md;

    // Calculate total samples to record
    size_t total_samples = static_cast<size_t>(duration * actual_rate);
    size_t samples_recorded = 0;

    // Register signal handler
    std::signal(SIGINT, &sig_int_handler);

    std::cout << "[IQ Recorder] Recording started..." << std::endl;

    auto start_time = std::chrono::steady_clock::now();

    // Recording loop
    while (!stop_signal_called && samples_recorded < total_samples) {
        size_t num_rx_samps = rx_stream->recv(&buffer.front(), buffer.size(), md, 3.0);

        if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_TIMEOUT) {
            std::cerr << "[IQ Recorder] WARNING: Timeout waiting for samples" << std::endl;
            continue;
        }
        if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_OVERFLOW) {
            std::cerr << "[IQ Recorder] WARNING: Overflow detected" << std::endl;
            continue;
        }
        if (md.error_code != uhd::rx_metadata_t::ERROR_CODE_NONE) {
            std::cerr << "[IQ Recorder] ERROR: " << md.strerror() << std::endl;
            break;
        }

        // Write samples to file
        outfile.write(reinterpret_cast<const char*>(&buffer.front()), 
                      num_rx_samps * sizeof(std::complex<float>));

        samples_recorded += num_rx_samps;

        // Progress update every second
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(now - start_time).count();
        if (elapsed > 0 && samples_recorded % static_cast<size_t>(actual_rate) < buffer_size) {
            double progress = 100.0 * samples_recorded / total_samples;
            std::cout << boost::format("\r[IQ Recorder] Progress: %.1f%% (%zu / %zu samples)") 
                         % progress % samples_recorded % total_samples << std::flush;
        }
    }

    std::cout << std::endl;

    // Stop streaming
    stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
    rx_stream->issue_stream_cmd(stream_cmd);

    // Close output file
    outfile.close();

    auto end_time = std::chrono::steady_clock::now();
    auto recording_duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count() / 1000.0;

    std::cout << "[IQ Recorder] Recording complete!" << std::endl;
    std::cout << "  Samples recorded: " << samples_recorded << std::endl;
    std::cout << "  Duration: " << recording_duration << " seconds" << std::endl;
    std::cout << "  File size: " << (samples_recorded * sizeof(std::complex<float>) / 1024.0 / 1024.0) << " MB" << std::endl;
    std::cout << "  Output: " << output_file << std::endl;

    return EXIT_SUCCESS;
}
