/**
 * Frequency Scanner - UHD-based B210 frequency sweeper with signal detection
 * 
 * Sweeps across frequency range, computes FFT at each step, detects signals
 * above threshold, and outputs JSON results.
 * 
 * Build: g++ -std=c++17 -o freq_scanner freq_scanner.cpp -luhd -lfftw3f -lpthread
 */

#include <uhd/usrp/multi_usrp.hpp>
#include <uhd/utils/safe_main.hpp>
#include <uhd/utils/thread.hpp>
#include <fftw3.h>
#include <iostream>
#include <fstream>
#include <complex>
#include <vector>
#include <cmath>
#include <chrono>
#include <thread>
#include <atomic>
#include <csignal>
#include <iomanip>
#include <sstream>
#include <algorithm>

// Global state for signal handling
std::atomic<bool> stop_signal_called(false);

void sig_int_handler(int) {
    stop_signal_called = true;
}

// Configuration structure
struct ScannerConfig {
    double start_freq = 88.0e6;      // Start frequency (Hz)
    double stop_freq = 108.0e6;      // Stop frequency (Hz)
    double step_freq = 1.0e6;        // Step size (Hz)
    double rate = 2.4e6;             // Sample rate (Hz)
    double gain = 40.0;              // RX gain (dB)
    size_t fft_size = 2048;          // FFT size
    double threshold_db = -80.0;     // Signal detection threshold (dBFS)
    double dwell_time = 0.1;         // Time to spend at each frequency (seconds)
    bool pause_on_signal = false;    // Pause when signal detected
    double pause_duration = 2.0;     // How long to pause (seconds)
    std::string device_args = "";    // UHD device args
    std::string subdev = "A:A";      // Subdevice spec
    std::string ant = "TX/RX";       // Antenna
};

// Signal detection result
struct SignalDetection {
    double frequency;     // Center frequency (Hz)
    double peak_power;    // Peak power (dBFS)
    double bandwidth;     // Estimated bandwidth (Hz)
    std::string timestamp;
};

// FFT Processor
class FFTProcessor {
private:
    size_t fft_size_;
    fftwf_complex* fft_in_;
    fftwf_complex* fft_out_;
    fftwf_plan plan_;
    std::vector<float> window_;
    std::vector<float> magnitude_db_;

public:
    FFTProcessor(size_t fft_size) : fft_size_(fft_size) {
        fft_in_ = (fftwf_complex*)fftwf_malloc(sizeof(fftwf_complex) * fft_size_);
        fft_out_ = (fftwf_complex*)fftwf_malloc(sizeof(fftwf_complex) * fft_size_);
        plan_ = fftwf_plan_dft_1d(fft_size_, fft_in_, fft_out_, FFTW_FORWARD, FFTW_MEASURE);
        
        // Hann window
        window_.resize(fft_size_);
        for (size_t i = 0; i < fft_size_; ++i) {
            window_[i] = 0.5 * (1.0 - std::cos(2.0 * M_PI * i / (fft_size_ - 1)));
        }
        
        magnitude_db_.resize(fft_size_);
    }

    ~FFTProcessor() {
        fftwf_destroy_plan(plan_);
        fftwf_free(fft_in_);
        fftwf_free(fft_out_);
    }

    const std::vector<float>& compute(const std::vector<std::complex<float>>& samples) {
        for (size_t i = 0; i < fft_size_; ++i) {
            fft_in_[i][0] = samples[i].real() * window_[i];
            fft_in_[i][1] = samples[i].imag() * window_[i];
        }
        
        fftwf_execute(plan_);
        
        for (size_t i = 0; i < fft_size_; ++i) {
            size_t shifted_idx = (i + fft_size_ / 2) % fft_size_;
            float real = fft_out_[i][0];
            float imag = fft_out_[i][1];
            float magnitude = std::sqrt(real * real + imag * imag);
            magnitude_db_[shifted_idx] = 20.0 * std::log10(magnitude + 1e-10);
        }
        
        return magnitude_db_;
    }
};

// Detect signals above threshold
std::vector<SignalDetection> detect_signals(
    const std::vector<float>& fft_data,
    double center_freq,
    double sample_rate,
    double threshold_db
) {
    std::vector<SignalDetection> detections;
    
    // Find peaks above threshold
    bool in_signal = false;
    size_t signal_start = 0;
    float peak_power = -200.0;
    
    for (size_t i = 1; i < fft_data.size() - 1; ++i) {
        if (fft_data[i] > threshold_db && !in_signal) {
            // Signal start
            in_signal = true;
            signal_start = i;
            peak_power = fft_data[i];
        } else if (in_signal) {
            // Track peak
            if (fft_data[i] > peak_power) {
                peak_power = fft_data[i];
            }
            
            // Signal end
            if (fft_data[i] <= threshold_db) {
                size_t signal_end = i;
                size_t signal_center = (signal_start + signal_end) / 2;
                
                // Calculate frequency offset
                double freq_offset = (static_cast<double>(signal_center) - fft_data.size() / 2.0) 
                                   * sample_rate / fft_data.size();
                double signal_freq = center_freq + freq_offset;
                
                // Estimate bandwidth
                double bandwidth = (signal_end - signal_start) * sample_rate / fft_data.size();
                
                // Get timestamp
                auto now = std::chrono::system_clock::now();
                auto timestamp = std::chrono::system_clock::to_time_t(now);
                std::stringstream ss;
                ss << std::put_time(std::localtime(&timestamp), "%Y-%m-%d %H:%M:%S");
                
                SignalDetection detection;
                detection.frequency = signal_freq;
                detection.peak_power = peak_power;
                detection.bandwidth = bandwidth;
                detection.timestamp = ss.str();
                
                detections.push_back(detection);
                
                in_signal = false;
            }
        }
    }
    
    return detections;
}

// Output scan progress as JSON
void output_progress_json(double current_freq, double start_freq, double stop_freq, size_t detections_count) {
    double progress = 100.0 * (current_freq - start_freq) / (stop_freq - start_freq);
    std::cout << "{\"type\":\"progress\",\"frequency\":" << std::fixed << std::setprecision(1) << (current_freq / 1e6)
              << ",\"progress\":" << std::fixed << std::setprecision(1) << progress
              << ",\"detections\":" << detections_count << "}" << std::endl;
}

// Output detection as JSON
void output_detection_json(const SignalDetection& detection) {
    std::cout << "{\"type\":\"detection\",\"frequency\":" << std::fixed << std::setprecision(6) << (detection.frequency / 1e6)
              << ",\"power\":" << std::fixed << std::setprecision(2) << detection.peak_power
              << ",\"bandwidth\":" << std::fixed << std::setprecision(1) << (detection.bandwidth / 1e3)
              << ",\"timestamp\":\"" << detection.timestamp << "\"}" << std::endl;
}

// Main scanning function
int UHD_SAFE_MAIN(int argc, char* argv[]) {
    uhd::set_thread_priority_safe();
    std::signal(SIGINT, &sig_int_handler);
    std::signal(SIGTERM, &sig_int_handler);
    
    ScannerConfig config;
    
    // Parse command line arguments
    for (int i = 1; i < argc; i += 2) {
        if (i + 1 >= argc) break;
        std::string arg = argv[i];
        std::string val = argv[i + 1];
        
        if (arg == "--start") config.start_freq = std::stod(val) * 1e6;
        else if (arg == "--stop") config.stop_freq = std::stod(val) * 1e6;
        else if (arg == "--step") config.step_freq = std::stod(val) * 1e6;
        else if (arg == "--rate") config.rate = std::stod(val) * 1e6;
        else if (arg == "--gain") config.gain = std::stod(val);
        else if (arg == "--threshold") config.threshold_db = std::stod(val);
        else if (arg == "--dwell") config.dwell_time = std::stod(val);
        else if (arg == "--pause-on-signal") config.pause_on_signal = (val == "true" || val == "1");
        else if (arg == "--pause-duration") config.pause_duration = std::stod(val);
        else if (arg == "--fft-size") config.fft_size = std::stoul(val);
    }
    
    std::cerr << "[Freq Scanner] Initializing USRP..." << std::endl;
    std::cerr << "[Freq Scanner] Scan range: " << (config.start_freq / 1e6) << " - " 
              << (config.stop_freq / 1e6) << " MHz" << std::endl;
    std::cerr << "[Freq Scanner] Step: " << (config.step_freq / 1e6) << " MHz" << std::endl;
    std::cerr << "[Freq Scanner] Threshold: " << config.threshold_db << " dBFS" << std::endl;
    
    // Create USRP device
    uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make(config.device_args);
    usrp->set_rx_subdev_spec(config.subdev);
    usrp->set_rx_rate(config.rate);
    usrp->set_rx_gain(config.gain);
    usrp->set_rx_antenna(config.ant);
    
    double actual_rate = usrp->get_rx_rate();
    
    // Create RX streamer
    uhd::stream_args_t stream_args("fc32", "sc16");
    uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);
    
    // Create FFT processor
    FFTProcessor fft_processor(config.fft_size);
    
    // Allocate receive buffer
    std::vector<std::complex<float>> buffer(config.fft_size);
    uhd::rx_metadata_t md;
    
    // Start streaming
    uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
    stream_cmd.stream_now = true;
    rx_stream->issue_stream_cmd(stream_cmd);
    
    std::cerr << "[Freq Scanner] Scan started" << std::endl;
    
    std::vector<SignalDetection> all_detections;
    size_t total_steps = static_cast<size_t>((config.stop_freq - config.start_freq) / config.step_freq) + 1;
    size_t current_step = 0;
    
    // Main scan loop
    for (double freq = config.start_freq; freq <= config.stop_freq && !stop_signal_called; freq += config.step_freq) {
        // Tune to frequency
        uhd::tune_request_t tune_request(freq);
        usrp->set_rx_freq(tune_request);
        
        // Wait for settling
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
        
        // Collect samples for dwell time
        auto dwell_start = std::chrono::steady_clock::now();
        std::vector<float> avg_fft(config.fft_size, 0.0);
        size_t num_ffts = 0;
        
        while (std::chrono::duration_cast<std::chrono::milliseconds>(
                   std::chrono::steady_clock::now() - dwell_start).count() < config.dwell_time * 1000) {
            
            size_t num_rx_samps = rx_stream->recv(&buffer.front(), buffer.size(), md, 1.0);
            
            if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_NONE && num_rx_samps == buffer.size()) {
                const auto& fft_data = fft_processor.compute(buffer);
                
                // Average FFTs
                for (size_t i = 0; i < config.fft_size; ++i) {
                    avg_fft[i] += fft_data[i];
                }
                num_ffts++;
            }
        }
        
        // Finalize average
        if (num_ffts > 0) {
            for (size_t i = 0; i < config.fft_size; ++i) {
                avg_fft[i] /= num_ffts;
            }
        }
        
        // Detect signals
        auto detections = detect_signals(avg_fft, freq, actual_rate, config.threshold_db);
        
        for (const auto& detection : detections) {
            all_detections.push_back(detection);
            output_detection_json(detection);
            
            // Pause if configured
            if (config.pause_on_signal) {
                std::cerr << "[Freq Scanner] Signal detected, pausing for " << config.pause_duration << "s" << std::endl;
                std::this_thread::sleep_for(std::chrono::milliseconds(static_cast<int>(config.pause_duration * 1000)));
            }
        }
        
        // Output progress
        current_step++;
        if (current_step % 10 == 0 || current_step == total_steps) {
            output_progress_json(freq, config.start_freq, config.stop_freq, all_detections.size());
        }
    }
    
    // Stop streaming
    stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
    rx_stream->issue_stream_cmd(stream_cmd);
    
    std::cerr << "\n[Freq Scanner] Scan complete!" << std::endl;
    std::cerr << "  Total detections: " << all_detections.size() << std::endl;
    
    // Output final summary
    std::cout << "{\"type\":\"complete\",\"detections\":" << all_detections.size() << "}" << std::endl;
    
    return EXIT_SUCCESS;
}
