/**
 * freq_scanner.cpp - Frequency Scanning Daemon
 * 
 * Scans a frequency range and reports peak power levels.
 * Useful for spectrum occupancy analysis and signal detection.
 * 
 * Usage:
 *   ./freq_scanner --start 900e6 --stop 930e6 --step 1e6 --rate 10e6 --gain 50
 * 
 * Output: JSON array of {frequency, peak_power} objects
 */

#include <uhd/usrp/multi_usrp.hpp>
#include <uhd/utils/safe_main.hpp>
#include <uhd/utils/thread.hpp>
#include <boost/program_options.hpp>
#include <boost/format.hpp>
#include <fftw3.h>
#include <iostream>
#include <csignal>
#include <complex>
#include <vector>
#include <cmath>

namespace po = boost::program_options;

static bool stop_signal_called = false;
void sig_int_handler(int) {
    stop_signal_called = true;
}

// Compute peak power in dBm from FFT
double compute_peak_power(const std::vector<std::complex<float>>& samples, size_t fft_size) {
    // Allocate FFTW buffers
    fftwf_complex* in = fftwf_alloc_complex(fft_size);
    fftwf_complex* out = fftwf_alloc_complex(fft_size);
    fftwf_plan plan = fftwf_plan_dft_1d(fft_size, in, out, FFTW_FORWARD, FFTW_ESTIMATE);

    // Copy samples to input buffer
    for (size_t i = 0; i < fft_size && i < samples.size(); ++i) {
        in[i][0] = samples[i].real();
        in[i][1] = samples[i].imag();
    }

    // Execute FFT
    fftwf_execute(plan);

    // Find peak power
    double peak_power = -200.0; // Start very low
    for (size_t i = 0; i < fft_size; ++i) {
        double real = out[i][0];
        double imag = out[i][1];
        double magnitude = std::sqrt(real * real + imag * imag) / fft_size;
        double power_dbm = 20.0 * std::log10(magnitude + 1e-20) - 30.0; // Convert to dBm
        if (power_dbm > peak_power) {
            peak_power = power_dbm;
        }
    }

    // Cleanup
    fftwf_destroy_plan(plan);
    fftwf_free(in);
    fftwf_free(out);

    return peak_power;
}

int UHD_SAFE_MAIN(int argc, char *argv[]) {
    // Set thread priority
    uhd::set_thread_priority_safe();

    // Command line options
    std::string device_args;
    double start_freq, stop_freq, step_freq, rate, gain;
    size_t fft_size, num_averages;

    po::options_description desc("Frequency Scanner Options");
    desc.add_options()
        ("help", "Show help message")
        ("args", po::value<std::string>(&device_args)->default_value(""), "UHD device args")
        ("start", po::value<double>(&start_freq)->default_value(900e6), "Start frequency (Hz)")
        ("stop", po::value<double>(&stop_freq)->default_value(930e6), "Stop frequency (Hz)")
        ("step", po::value<double>(&step_freq)->default_value(1e6), "Step frequency (Hz)")
        ("rate", po::value<double>(&rate)->default_value(10e6), "Sample rate (Hz)")
        ("gain", po::value<double>(&gain)->default_value(50), "RX gain (dB)")
        ("fft-size", po::value<size_t>(&fft_size)->default_value(2048), "FFT size")
        ("averages", po::value<size_t>(&num_averages)->default_value(10), "Number of averages per frequency")
    ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);

    if (vm.count("help")) {
        std::cout << desc << std::endl;
        return EXIT_SUCCESS;
    }

    std::cout << "[Freq Scanner] Starting..." << std::endl;
    std::cout << "  Frequency range: " << start_freq / 1e6 << " - " << stop_freq / 1e6 << " MHz" << std::endl;
    std::cout << "  Step size: " << step_freq / 1e6 << " MHz" << std::endl;
    std::cout << "  Sample rate: " << rate / 1e6 << " MSPS" << std::endl;
    std::cout << "  RX gain: " << gain << " dB" << std::endl;
    std::cout << "  FFT size: " << fft_size << std::endl;
    std::cout << "  Averages: " << num_averages << std::endl;

    // Create USRP device
    std::cout << "[Freq Scanner] Creating USRP device..." << std::endl;
    uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make(device_args);

    // Set sample rate
    usrp->set_rx_rate(rate);
    double actual_rate = usrp->get_rx_rate();
    std::cout << "[Freq Scanner] Actual sample rate: " << actual_rate / 1e6 << " MSPS" << std::endl;

    // Set RX gain
    usrp->set_rx_gain(gain);
    double actual_gain = usrp->get_rx_gain();
    std::cout << "[Freq Scanner] Actual RX gain: " << actual_gain << " dB" << std::endl;

    // Set antenna
    usrp->set_rx_antenna("TX/RX");

    // Create RX streamer
    uhd::stream_args_t stream_args("fc32", "sc16");
    uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);

    // Allocate buffer
    std::vector<std::complex<float>> buffer(fft_size);
    uhd::rx_metadata_t md;

    // Register signal handler
    std::signal(SIGINT, &sig_int_handler);

    // Calculate number of steps
    size_t num_steps = static_cast<size_t>((stop_freq - start_freq) / step_freq) + 1;
    std::cout << "[Freq Scanner] Scanning " << num_steps << " frequencies..." << std::endl;

    // Output JSON array start
    std::cout << "[" << std::endl;

    // Scan loop
    size_t step_count = 0;
    for (double freq = start_freq; freq <= stop_freq && !stop_signal_called; freq += step_freq) {
        // Tune to frequency
        uhd::tune_request_t tune_request(freq);
        usrp->set_rx_freq(tune_request);
        double actual_freq = usrp->get_rx_freq();

        // Allow time for frequency to settle
        std::this_thread::sleep_for(std::chrono::milliseconds(50));

        // Start streaming
        uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
        stream_cmd.stream_now = true;
        rx_stream->issue_stream_cmd(stream_cmd);

        // Collect averages
        double avg_peak_power = 0.0;
        for (size_t avg = 0; avg < num_averages; ++avg) {
            size_t num_rx_samps = rx_stream->recv(&buffer.front(), buffer.size(), md, 1.0);

            if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_NONE && num_rx_samps == fft_size) {
                double peak_power = compute_peak_power(buffer, fft_size);
                avg_peak_power += peak_power;
            }
        }
        avg_peak_power /= num_averages;

        // Stop streaming
        stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
        rx_stream->issue_stream_cmd(stream_cmd);

        // Output JSON object
        std::cout << "  {";
        std::cout << "\"frequency\": " << actual_freq << ", ";
        std::cout << "\"peak_power_dbm\": " << avg_peak_power;
        std::cout << "}";
        if (freq + step_freq <= stop_freq) {
            std::cout << ",";
        }
        std::cout << std::endl;

        step_count++;
        double progress = 100.0 * step_count / num_steps;
        std::cerr << boost::format("\r[Freq Scanner] Progress: %.1f%% (%zu / %zu)") 
                     % progress % step_count % num_steps << std::flush;
    }

    std::cerr << std::endl;

    // Output JSON array end
    std::cout << "]" << std::endl;

    std::cerr << "[Freq Scanner] Scan complete!" << std::endl;

    return EXIT_SUCCESS;
}
