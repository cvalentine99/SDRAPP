/**
 * freq_scanner.cpp - Frequency Scanning Daemon
 *
 * Scans a frequency range and reports peak power levels.
 * Useful for spectrum occupancy analysis and signal detection.
 *
 * Features:
 * - Blackman-Harris window for improved spectral accuracy (-92 dB sidelobes)
 * - Configurable averaging for noise reduction
 * - JSON output for easy parsing
 *
 * Usage:
 *   ./freq_scanner --start 900e6 --stop 930e6 --step 1e6 --rate 10e6 --gain 50
 *
 * Output: JSON array of {frequency, peak_power_dbm, avg_power_dbm} objects
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
#include <numeric>

namespace po = boost::program_options;

static bool stop_signal_called = false;
void sig_int_handler(int) {
    stop_signal_called = true;
}

// ============================================================================
// Window Functions
// ============================================================================

enum class WindowType {
    RECTANGULAR,
    HANN,
    BLACKMAN_HARRIS
};

// Generate window coefficients
std::vector<float> generate_window(size_t size, WindowType type) {
    std::vector<float> window(size);

    switch (type) {
        case WindowType::RECTANGULAR:
            std::fill(window.begin(), window.end(), 1.0f);
            break;

        case WindowType::HANN:
            for (size_t i = 0; i < size; ++i) {
                window[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (size - 1)));
            }
            break;

        case WindowType::BLACKMAN_HARRIS:
            // 4-term Blackman-Harris window
            // Provides -92 dB sidelobe suppression (vs -13 dB for rectangular)
            for (size_t i = 0; i < size; ++i) {
                double n = static_cast<double>(i) / (size - 1);
                window[i] = static_cast<float>(
                    0.35875 - 0.48829 * std::cos(2.0 * M_PI * n)
                            + 0.14128 * std::cos(4.0 * M_PI * n)
                            - 0.01168 * std::cos(6.0 * M_PI * n)
                );
            }
            break;
    }

    return window;
}

// Calculate coherent gain of window (for power correction)
double window_coherent_gain(const std::vector<float>& window) {
    double sum = 0.0;
    for (float w : window) {
        sum += w;
    }
    return sum / window.size();
}

// ============================================================================
// FFT Power Computation
// ============================================================================

struct PowerResult {
    double peak_power_dbm;
    double avg_power_dbm;
    size_t peak_bin;
};

// Compute power spectrum with windowing
PowerResult compute_power_spectrum(
    const std::vector<std::complex<float>>& samples,
    const std::vector<float>& window,
    fftwf_complex* fft_in,
    fftwf_complex* fft_out,
    fftwf_plan plan,
    size_t fft_size,
    double coherent_gain
) {
    // Apply window and copy to FFT input
    for (size_t i = 0; i < fft_size && i < samples.size(); ++i) {
        fft_in[i][0] = samples[i].real() * window[i];
        fft_in[i][1] = samples[i].imag() * window[i];
    }

    // Execute FFT
    fftwf_execute(plan);

    // Compute power spectrum and find peak
    double peak_power = -200.0;
    double total_power = 0.0;
    size_t peak_bin = 0;

    // Correction factor for window energy loss
    double window_correction = 1.0 / (coherent_gain * coherent_gain);

    for (size_t i = 0; i < fft_size; ++i) {
        double real = fft_out[i][0];
        double imag = fft_out[i][1];

        // Normalized magnitude squared (power)
        double power = (real * real + imag * imag) / (fft_size * fft_size);

        // Apply window correction
        power *= window_correction;

        // Convert to dBm (assuming 50 ohm, 0 dBFS = 0 dBm for normalized input)
        double power_dbm = 10.0 * std::log10(power + 1e-20);

        total_power += power;

        if (power_dbm > peak_power) {
            peak_power = power_dbm;
            peak_bin = i;
        }
    }

    // Average power across all bins
    double avg_power_dbm = 10.0 * std::log10(total_power / fft_size + 1e-20);

    return {peak_power, avg_power_dbm, peak_bin};
}

// ============================================================================
// Main
// ============================================================================

int UHD_SAFE_MAIN(int argc, char *argv[]) {
    // Set thread priority
    uhd::set_thread_priority_safe();

    // Command line options
    std::string device_args, window_type_str;
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
        ("window", po::value<std::string>(&window_type_str)->default_value("blackman-harris"),
         "Window function: rectangular, hann, blackman-harris")
    ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);

    if (vm.count("help")) {
        std::cout << desc << std::endl;
        return EXIT_SUCCESS;
    }

    // Parse window type
    WindowType window_type = WindowType::BLACKMAN_HARRIS;
    if (window_type_str == "rectangular") {
        window_type = WindowType::RECTANGULAR;
    } else if (window_type_str == "hann") {
        window_type = WindowType::HANN;
    } else if (window_type_str == "blackman-harris") {
        window_type = WindowType::BLACKMAN_HARRIS;
    } else {
        std::cerr << "Unknown window type: " << window_type_str << std::endl;
        std::cerr << "Valid options: rectangular, hann, blackman-harris" << std::endl;
        return EXIT_FAILURE;
    }

    std::cerr << "[Freq Scanner] Starting..." << std::endl;
    std::cerr << "  Frequency range: " << start_freq / 1e6 << " - " << stop_freq / 1e6 << " MHz" << std::endl;
    std::cerr << "  Step size: " << step_freq / 1e6 << " MHz" << std::endl;
    std::cerr << "  Sample rate: " << rate / 1e6 << " MSPS" << std::endl;
    std::cerr << "  RX gain: " << gain << " dB" << std::endl;
    std::cerr << "  FFT size: " << fft_size << std::endl;
    std::cerr << "  Averages: " << num_averages << std::endl;
    std::cerr << "  Window: " << window_type_str << std::endl;

    // Generate window function
    std::vector<float> window = generate_window(fft_size, window_type);
    double coherent_gain = window_coherent_gain(window);
    std::cerr << "  Window coherent gain: " << coherent_gain << std::endl;

    // Create USRP device
    std::cerr << "[Freq Scanner] Creating USRP device..." << std::endl;
    uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make(device_args);

    // Set sample rate
    usrp->set_rx_rate(rate);
    double actual_rate = usrp->get_rx_rate();
    std::cerr << "[Freq Scanner] Actual sample rate: " << actual_rate / 1e6 << " MSPS" << std::endl;

    // Set RX gain
    usrp->set_rx_gain(gain);
    double actual_gain = usrp->get_rx_gain();
    std::cerr << "[Freq Scanner] Actual RX gain: " << actual_gain << " dB" << std::endl;

    // Set antenna
    usrp->set_rx_antenna("TX/RX");

    // Create RX streamer
    uhd::stream_args_t stream_args("fc32", "sc16");
    uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);

    // Allocate buffers
    std::vector<std::complex<float>> buffer(fft_size);
    uhd::rx_metadata_t md;

    // Allocate FFTW buffers (reuse across all frequencies)
    fftwf_complex* fft_in = fftwf_alloc_complex(fft_size);
    fftwf_complex* fft_out = fftwf_alloc_complex(fft_size);
    fftwf_plan plan = fftwf_plan_dft_1d(fft_size, fft_in, fft_out, FFTW_FORWARD, FFTW_MEASURE);

    // Register signal handler
    std::signal(SIGINT, &sig_int_handler);
    std::signal(SIGTERM, &sig_int_handler);

    // Calculate number of steps
    size_t num_steps = static_cast<size_t>((stop_freq - start_freq) / step_freq) + 1;
    std::cerr << "[Freq Scanner] Scanning " << num_steps << " frequencies..." << std::endl;

    // Output JSON array start
    std::cout << "[" << std::endl;

    // Scan loop
    size_t step_count = 0;
    for (double freq = start_freq; freq <= stop_freq && !stop_signal_called; freq += step_freq) {
        // Tune to frequency
        uhd::tune_request_t tune_request(freq);
        usrp->set_rx_freq(tune_request);
        double actual_freq = usrp->get_rx_freq();

        // Allow time for frequency to settle (PLL lock)
        std::this_thread::sleep_for(std::chrono::milliseconds(50));

        // Start streaming
        uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
        stream_cmd.stream_now = true;
        rx_stream->issue_stream_cmd(stream_cmd);

        // Collect and average multiple measurements
        double sum_peak_power = 0.0;
        double sum_avg_power = 0.0;
        double max_peak_power = -200.0;
        size_t valid_measurements = 0;

        for (size_t avg = 0; avg < num_averages; ++avg) {
            size_t num_rx_samps = rx_stream->recv(&buffer.front(), buffer.size(), md, 1.0);

            if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_NONE && num_rx_samps == fft_size) {
                PowerResult result = compute_power_spectrum(
                    buffer, window, fft_in, fft_out, plan, fft_size, coherent_gain
                );

                sum_peak_power += result.peak_power_dbm;
                sum_avg_power += result.avg_power_dbm;
                if (result.peak_power_dbm > max_peak_power) {
                    max_peak_power = result.peak_power_dbm;
                }
                valid_measurements++;
            }
        }

        // Stop streaming
        stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
        rx_stream->issue_stream_cmd(stream_cmd);

        // Calculate averages
        double avg_peak_power = (valid_measurements > 0) ? sum_peak_power / valid_measurements : -200.0;
        double avg_avg_power = (valid_measurements > 0) ? sum_avg_power / valid_measurements : -200.0;

        // Output JSON object with enhanced data
        std::cout << "  {";
        std::cout << "\"frequency\": " << std::fixed << std::setprecision(0) << actual_freq << ", ";
        std::cout << "\"peak_power_dbm\": " << std::fixed << std::setprecision(2) << avg_peak_power << ", ";
        std::cout << "\"max_peak_dbm\": " << std::fixed << std::setprecision(2) << max_peak_power << ", ";
        std::cout << "\"avg_power_dbm\": " << std::fixed << std::setprecision(2) << avg_avg_power << ", ";
        std::cout << "\"measurements\": " << valid_measurements;
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

    // Cleanup FFTW
    fftwf_destroy_plan(plan);
    fftwf_free(fft_in);
    fftwf_free(fft_out);

    std::cerr << "[Freq Scanner] Scan complete!" << std::endl;
    std::cerr << "  Window type: " << window_type_str << std::endl;
    std::cerr << "  Sidelobe suppression: ";
    switch (window_type) {
        case WindowType::RECTANGULAR:
            std::cerr << "-13 dB (rectangular)";
            break;
        case WindowType::HANN:
            std::cerr << "-31 dB (Hann)";
            break;
        case WindowType::BLACKMAN_HARRIS:
            std::cerr << "-92 dB (Blackman-Harris)";
            break;
    }
    std::cerr << std::endl;

    return EXIT_SUCCESS;
}
