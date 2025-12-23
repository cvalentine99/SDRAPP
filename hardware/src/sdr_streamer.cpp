/**
 * SDR Streamer - UHD-based B210 streaming daemon with FFT computation
 * 
 * Reads IQ samples from Ettus B210, computes FFT, outputs JSON to stdout
 * for consumption by Node.js WebSocket server.
 * 
 * Build: g++ -std=c++17 -o sdr_streamer sdr_streamer.cpp -luhd -lfftw3f -lpthread
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

// Global state for signal handling
std::atomic<bool> stop_signal_called(false);

void sig_int_handler(int) {
    stop_signal_called = true;
}

// Configuration structure
struct SDRConfig {
    double freq = 915.0e6;        // Center frequency (Hz)
    double rate = 10.0e6;         // Sample rate (Hz)
    double gain = 50.0;           // RX gain (dB)
    size_t fft_size = 2048;       // FFT size
    std::string device_args = ""; // UHD device args
    std::string subdev = "A:A";   // Subdevice spec
    std::string ant = "TX/RX";    // Antenna
    double bw = 0.0;              // Analog bandwidth (0 = auto)
};

// FFT Processor using FFTW3
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
        // Allocate FFTW buffers
        fft_in_ = (fftwf_complex*)fftwf_malloc(sizeof(fftwf_complex) * fft_size_);
        fft_out_ = (fftwf_complex*)fftwf_malloc(sizeof(fftwf_complex) * fft_size_);
        
        // Create FFTW plan
        plan_ = fftwf_plan_dft_1d(fft_size_, fft_in_, fft_out_, FFTW_FORWARD, FFTW_MEASURE);
        
        // Generate Hann window
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

    // Compute FFT and return magnitude in dB
    const std::vector<float>& compute(const std::vector<std::complex<float>>& samples) {
        // Apply window and copy to FFT input
        for (size_t i = 0; i < fft_size_; ++i) {
            fft_in_[i][0] = samples[i].real() * window_[i];
            fft_in_[i][1] = samples[i].imag() * window_[i];
        }
        
        // Execute FFT
        fftwf_execute(plan_);
        
        // Compute magnitude in dB and FFT shift
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

// Output JSON FFT data to stdout
void output_fft_json(const std::vector<float>& fft_data, double center_freq, double sample_rate, size_t fft_size) {
    auto now = std::chrono::system_clock::now();
    auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(now.time_since_epoch()).count();
    
    std::cout << "{\"type\":\"fft\",\"timestamp\":" << timestamp
              << ",\"centerFrequency\":" << std::fixed << std::setprecision(1) << (center_freq / 1e6)
              << ",\"sampleRate\":" << std::fixed << std::setprecision(1) << (sample_rate / 1e6)
              << ",\"fftSize\":" << fft_size
              << ",\"data\":[";
    
    for (size_t i = 0; i < fft_data.size(); ++i) {
        if (i > 0) std::cout << ",";
        std::cout << std::fixed << std::setprecision(2) << fft_data[i];
    }
    
    std::cout << "]}" << std::endl;
}

// Main streaming function
int UHD_SAFE_MAIN(int argc, char* argv[]) {
    // Set thread priority
    uhd::set_thread_priority_safe();
    
    // Register signal handler
    std::signal(SIGINT, &sig_int_handler);
    std::signal(SIGTERM, &sig_int_handler);
    
    SDRConfig config;
    
    // Parse command line arguments
    for (int i = 1; i < argc; i += 2) {
        if (i + 1 >= argc) break;
        std::string arg = argv[i];
        std::string val = argv[i + 1];
        
        if (arg == "--freq") config.freq = std::stod(val) * 1e6;
        else if (arg == "--rate") config.rate = std::stod(val) * 1e6;
        else if (arg == "--gain") config.gain = std::stod(val);
        else if (arg == "--fft-size") config.fft_size = std::stoul(val);
        else if (arg == "--device") config.device_args = val;
        else if (arg == "--subdev") config.subdev = val;
        else if (arg == "--ant") config.ant = val;
        else if (arg == "--bw") config.bw = std::stod(val) * 1e6;
    }
    
    std::cerr << "[SDR Streamer] Initializing USRP..." << std::endl;
    
    // Create USRP device
    uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make(config.device_args);
    
    // Set subdevice spec
    usrp->set_rx_subdev_spec(config.subdev);
    
    // Set sample rate
    usrp->set_rx_rate(config.rate);
    double actual_rate = usrp->get_rx_rate();
    std::cerr << "[SDR Streamer] Sample rate: " << (actual_rate / 1e6) << " MSPS" << std::endl;
    
    // Set center frequency
    uhd::tune_request_t tune_request(config.freq);
    usrp->set_rx_freq(tune_request);
    double actual_freq = usrp->get_rx_freq();
    std::cerr << "[SDR Streamer] Center frequency: " << (actual_freq / 1e6) << " MHz" << std::endl;
    
    // Set gain
    usrp->set_rx_gain(config.gain);
    double actual_gain = usrp->get_rx_gain();
    std::cerr << "[SDR Streamer] RX gain: " << actual_gain << " dB" << std::endl;
    
    // Set antenna
    usrp->set_rx_antenna(config.ant);
    
    // Set bandwidth
    if (config.bw > 0.0) {
        usrp->set_rx_bandwidth(config.bw);
    }
    
    // Create RX streamer
    uhd::stream_args_t stream_args("fc32", "sc16");
    uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);
    
    // Start streaming
    uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
    stream_cmd.stream_now = true;
    rx_stream->issue_stream_cmd(stream_cmd);
    
    std::cerr << "[SDR Streamer] Streaming started" << std::endl;
    
    // Create FFT processor
    FFTProcessor fft_processor(config.fft_size);
    
    // Allocate receive buffer
    std::vector<std::complex<float>> buffer(config.fft_size);
    uhd::rx_metadata_t md;
    
    // Target 60 FPS
    auto frame_duration = std::chrono::microseconds(16667); // ~60 FPS
    auto next_frame_time = std::chrono::steady_clock::now();
    
    // Main streaming loop
    while (!stop_signal_called) {
        // Receive samples
        size_t num_rx_samps = rx_stream->recv(&buffer.front(), buffer.size(), md, 3.0);
        
        // Check for incomplete buffer
        if (num_rx_samps < config.fft_size) {
            std::cerr << "[SDR Streamer] Incomplete buffer (" << num_rx_samps 
                      << " < " << config.fft_size << "), skipping" << std::endl;
            continue;
        }
        
        // Check for errors
        if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_TIMEOUT) {
            std::cerr << "[SDR Streamer] Timeout waiting for samples" << std::endl;
            continue;
        }
        if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_OVERFLOW) {
            std::cerr << "[SDR Streamer] Overflow detected" << std::endl;
            continue;
        }
        if (md.error_code != uhd::rx_metadata_t::ERROR_CODE_NONE) {
            std::cerr << "[SDR Streamer] Receiver error: " << md.strerror() << std::endl;
            continue;
        }
        
        // Compute FFT
        const auto& fft_data = fft_processor.compute(buffer);
        
        // Output JSON
        output_fft_json(fft_data, actual_freq, actual_rate, config.fft_size);
        
        // Rate limiting to ~60 FPS
        next_frame_time += frame_duration;
        std::this_thread::sleep_until(next_frame_time);
    }
    
    // Stop streaming
    stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
    rx_stream->issue_stream_cmd(stream_cmd);
    
    std::cerr << "[SDR Streamer] Stopped" << std::endl;
    
    return EXIT_SUCCESS;
}
