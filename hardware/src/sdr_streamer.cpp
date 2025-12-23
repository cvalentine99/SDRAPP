/**
 * sdr_streamer.cpp - Ettus B210 USRP SDR Streaming Daemon
 * 
 * Hardware: B210 (serial 194919) with GPSTCXO v3.2 GPSDO
 * Connection: USB 3.0
 * RX: 50-6000 MHz, 0-76 dB gain, 200 kHz - 56 MHz BW
 * TX: 50-6000 MHz, 0-89.8 dB gain
 * 
 * Outputs JSON FFT data to stdout for Node.js consumption
 */

#include <uhd/usrp/multi_usrp.hpp>
#include <uhd/utils/safe_main.hpp>
#include <uhd/utils/thread.hpp>
#include <fftw3.h>
#include <boost/program_options.hpp>
#include <boost/format.hpp>
#include <iostream>
#include <fstream>
#include <csignal>
#include <complex>
#include <vector>
#include <cmath>
#include <chrono>
#include <iomanip>

namespace po = boost::program_options;

// Global flag for clean shutdown
static bool stop_signal_called = false;

void sig_int_handler(int) {
    stop_signal_called = true;
}

// B210 hardware limits (from uhd_usrp_probe)
constexpr double B210_MIN_FREQ = 50e6;      // 50 MHz
constexpr double B210_MAX_FREQ = 6000e6;    // 6000 MHz
constexpr double B210_MIN_RX_GAIN = 0.0;    // 0 dB
constexpr double B210_MAX_RX_GAIN = 76.0;   // 76 dB
constexpr double B210_MIN_TX_GAIN = 0.0;    // 0 dB
constexpr double B210_MAX_TX_GAIN = 89.8;   // 89.8 dB
constexpr double B210_MIN_BW = 200e3;       // 200 kHz
constexpr double B210_MAX_BW = 56e6;        // 56 MHz

struct GPSDOStatus {
    bool locked;
    std::string time;
    std::string gpgga;
    std::string gprmc;
    double servo;
};

GPSDOStatus get_gpsdo_status(uhd::usrp::multi_usrp::sptr usrp) {
    GPSDOStatus status;
    try {
        status.locked = usrp->get_mboard_sensor("gps_locked").to_bool();
        status.time = usrp->get_mboard_sensor("gps_time").value;
        status.gpgga = usrp->get_mboard_sensor("gps_gpgga").value;
        status.gprmc = usrp->get_mboard_sensor("gps_gprmc").value;
        status.servo = std::stod(usrp->get_mboard_sensor("gps_servo").value);
    } catch (...) {
        status.locked = false;
        status.time = "unavailable";
    }
    return status;
}

int UHD_SAFE_MAIN(int argc, char *argv[]) {
    // Set thread priority
    uhd::set_thread_priority_safe();

    // Command line options
    std::string device_args, subdev, ant, ref, clock_source;
    double freq, rate, gain, bw;
    size_t fft_size;
    bool use_gpsdo;

    po::options_description desc("Allowed options");
    desc.add_options()
        ("help", "help message")
        ("args", po::value<std::string>(&device_args)->default_value(""), "UHD device args")
        ("freq", po::value<double>(&freq)->default_value(915e6), "RF center frequency in Hz")
        ("rate", po::value<double>(&rate)->default_value(10e6), "Sample rate in Hz")
        ("gain", po::value<double>(&gain)->default_value(50), "RX gain in dB")
        ("bw", po::value<double>(&bw)->default_value(10e6), "Analog bandwidth in Hz")
        ("ant", po::value<std::string>(&ant)->default_value("RX2"), "Antenna selection")
        ("subdev", po::value<std::string>(&subdev)->default_value("A:A"), "Subdevice specification")
        ("ref", po::value<std::string>(&ref)->default_value("internal"), "Reference source (internal/external/gpsdo)")
        ("clock", po::value<std::string>(&clock_source)->default_value("internal"), "Clock source")
        ("fft-size", po::value<size_t>(&fft_size)->default_value(2048), "FFT size")
        ("gpsdo", po::value<bool>(&use_gpsdo)->default_value(true), "Use GPSDO if available")
    ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);

    if (vm.count("help")) {
        std::cout << desc << std::endl;
        return EXIT_SUCCESS;
    }

    // Validate B210 hardware limits
    if (freq < B210_MIN_FREQ || freq > B210_MAX_FREQ) {
        std::cerr << "Error: Frequency " << freq/1e6 << " MHz out of range ["
                  << B210_MIN_FREQ/1e6 << "-" << B210_MAX_FREQ/1e6 << " MHz]" << std::endl;
        return EXIT_FAILURE;
    }
    if (gain < B210_MIN_RX_GAIN || gain > B210_MAX_RX_GAIN) {
        std::cerr << "Error: RX gain " << gain << " dB out of range ["
                  << B210_MIN_RX_GAIN << "-" << B210_MAX_RX_GAIN << " dB]" << std::endl;
        return EXIT_FAILURE;
    }
    if (bw < B210_MIN_BW || bw > B210_MAX_BW) {
        std::cerr << "Error: Bandwidth " << bw/1e6 << " MHz out of range ["
                  << B210_MIN_BW/1e6 << "-" << B210_MAX_BW/1e6 << " MHz]" << std::endl;
        return EXIT_FAILURE;
    }

    // Create USRP device
    std::cerr << "Creating B210 USRP device with args: " << device_args << std::endl;
    uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make(device_args);

    // Detect GPSDO and configure clock/time source
    if (use_gpsdo) {
        try {
            auto sensors = usrp->get_mboard_sensor_names(0);
            bool has_gpsdo = std::find(sensors.begin(), sensors.end(), "gps_locked") != sensors.end();
            
            if (has_gpsdo) {
                std::cerr << "GPSDO detected, configuring time/clock source..." << std::endl;
                usrp->set_clock_source("gpsdo");
                usrp->set_time_source("gpsdo");
                
                // Wait for GPS lock
                std::cerr << "Waiting for GPS lock..." << std::endl;
                auto start = std::chrono::steady_clock::now();
                while (!usrp->get_mboard_sensor("gps_locked").to_bool()) {
                    auto elapsed = std::chrono::duration_cast<std::chrono::seconds>(
                        std::chrono::steady_clock::now() - start).count();
                    if (elapsed > 300) {  // 5 minute timeout
                        std::cerr << "Warning: GPS lock timeout, using internal reference" << std::endl;
                        usrp->set_clock_source("internal");
                        usrp->set_time_source("internal");
                        break;
                    }
                    std::this_thread::sleep_for(std::chrono::seconds(1));
                }
                
                if (usrp->get_mboard_sensor("gps_locked").to_bool()) {
                    std::cerr << "GPS locked!" << std::endl;
                }
            } else {
                std::cerr << "No GPSDO detected, using internal reference" << std::endl;
                usrp->set_clock_source(clock_source);
                usrp->set_time_source(ref);
            }
        } catch (const std::exception& e) {
            std::cerr << "GPSDO configuration error: " << e.what() << std::endl;
            usrp->set_clock_source(clock_source);
            usrp->set_time_source(ref);
        }
    } else {
        usrp->set_clock_source(clock_source);
        usrp->set_time_source(ref);
    }

    // Configure RX
    usrp->set_rx_subdev_spec(subdev);
    usrp->set_rx_rate(rate);
    usrp->set_rx_freq(freq);
    usrp->set_rx_gain(gain);
    usrp->set_rx_bandwidth(bw);
    usrp->set_rx_antenna(ant);

    std::this_thread::sleep_for(std::chrono::seconds(1)); // Allow hardware to settle

    // Print actual settings
    std::cerr << boost::format("Actual RX Rate: %f Msps") % (usrp->get_rx_rate()/1e6) << std::endl;
    std::cerr << boost::format("Actual RX Freq: %f MHz") % (usrp->get_rx_freq()/1e6) << std::endl;
    std::cerr << boost::format("Actual RX Gain: %f dB") % usrp->get_rx_gain() << std::endl;
    std::cerr << boost::format("Actual RX BW: %f MHz") % (usrp->get_rx_bandwidth()/1e6) << std::endl;

    // Setup streaming
    uhd::stream_args_t stream_args("fc32", "sc16");
    uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);

    uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
    stream_cmd.stream_now = true;
    rx_stream->issue_stream_cmd(stream_cmd);

    // Allocate buffers
    std::vector<std::complex<float>> buffer(fft_size);
    std::vector<std::complex<float>*> buffs{buffer.data()};
    
    // FFTW setup
    fftwf_complex* fft_in = fftwf_alloc_complex(fft_size);
    fftwf_complex* fft_out = fftwf_alloc_complex(fft_size);
    fftwf_plan plan = fftwf_plan_dft_1d(fft_size, fft_in, fft_out, FFTW_FORWARD, FFTW_MEASURE);

    // Hann window
    std::vector<float> window(fft_size);
    for (size_t i = 0; i < fft_size; i++) {
        window[i] = 0.5 * (1.0 - std::cos(2.0 * M_PI * i / (fft_size - 1)));
    }

    // Signal handler
    std::signal(SIGINT, &sig_int_handler);
    std::signal(SIGTERM, &sig_int_handler);

    uhd::rx_metadata_t md;
    size_t frame_count = 0;
    auto last_status_time = std::chrono::steady_clock::now();

    while (!stop_signal_called) {
        // Receive samples
        size_t num_rx_samps = rx_stream->recv(buffs, fft_size, md, 3.0);

        // Handle errors
        if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_TIMEOUT) {
            std::cerr << "Timeout while streaming" << std::endl;
            continue;
        }
        if (md.error_code != uhd::rx_metadata_t::ERROR_CODE_NONE) {
            std::cerr << "Receiver error: " << md.strerror() << std::endl;
            continue;
        }

        // Bounds check
        if (num_rx_samps < fft_size) {
            std::cerr << "Warning: Incomplete sample buffer (" << num_rx_samps 
                      << "/" << fft_size << "), skipping FFT" << std::endl;
            continue;
        }

        // Apply window and copy to FFT input
        for (size_t i = 0; i < fft_size; i++) {
            fft_in[i][0] = buffer[i].real() * window[i];
            fft_in[i][1] = buffer[i].imag() * window[i];
        }

        // Compute FFT
        fftwf_execute(plan);

        // Compute power spectrum (dBFS) and find peak
        std::vector<float> power_db(fft_size);
        float peak_power = -200.0f;
        size_t peak_bin = 0;
        
        for (size_t i = 0; i < fft_size; i++) {
            // FFT shift
            size_t j = (i + fft_size/2) % fft_size;
            float real = fft_out[j][0];
            float imag = fft_out[j][1];
            float power = (real*real + imag*imag) / (fft_size * fft_size);
            power_db[i] = 10.0f * std::log10(power + 1e-20f);  // Avoid log(0)
            
            if (power_db[i] > peak_power) {
                peak_power = power_db[i];
                peak_bin = i;
            }
        }

        // Output JSON FFT data
        std::cout << "{\"type\":\"fft\",\"timestamp\":" << md.time_spec.get_real_secs()
                  << ",\"centerFreq\":" << freq
                  << ",\"sampleRate\":" << rate
                  << ",\"fftSize\":" << fft_size
                  << ",\"peakPower\":" << peak_power
                  << ",\"peakBin\":" << peak_bin
                  << ",\"data\":[";
        
        for (size_t i = 0; i < fft_size; i++) {
            std::cout << power_db[i];
            if (i < fft_size - 1) std::cout << ",";
        }
        std::cout << "]}" << std::endl;

        frame_count++;

        // Periodic status update with GPSDO info (every 10 seconds)
        auto now = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::seconds>(now - last_status_time).count() >= 10) {
            GPSDOStatus gps = get_gpsdo_status(usrp);
            
            // Get temperature sensors
            float rx_temp = 0.0f, tx_temp = 0.0f;
            try {
                rx_temp = std::stof(usrp->get_rx_sensor("temp").value);
                tx_temp = std::stof(usrp->get_tx_sensor("temp").value);
            } catch (...) {}

            std::cout << "{\"type\":\"status\""
                      << ",\"frames\":" << frame_count
                      << ",\"gpsLocked\":" << (gps.locked ? "true" : "false")
                      << ",\"gpsTime\":\"" << gps.time << "\""
                      << ",\"gpsServo\":" << gps.servo
                      << ",\"rxTemp\":" << rx_temp
                      << ",\"txTemp\":" << tx_temp
                      << "}" << std::endl;
            
            last_status_time = now;
        }
    }

    // Cleanup
    stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
    rx_stream->issue_stream_cmd(stream_cmd);

    fftwf_destroy_plan(plan);
    fftwf_free(fft_in);
    fftwf_free(fft_out);

    std::cerr << "Streaming stopped cleanly" << std::endl;
    return EXIT_SUCCESS;
}
