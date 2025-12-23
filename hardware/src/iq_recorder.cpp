/**
 * IQ Recorder - UHD-based B210 IQ sample recorder
 * 
 * Records raw IQ samples from Ettus B210 to file in complex float32 format.
 * Compatible with SigMF and GNU Radio.
 * 
 * Build: g++ -std=c++17 -o iq_recorder iq_recorder.cpp -luhd -lpthread
 */

#include <uhd/usrp/multi_usrp.hpp>
#include <uhd/utils/safe_main.hpp>
#include <uhd/utils/thread.hpp>
#include <iostream>
#include <fstream>
#include <complex>
#include <vector>
#include <chrono>
#include <thread>
#include <atomic>
#include <csignal>
#include <iomanip>

// Global state for signal handling
std::atomic<bool> stop_signal_called(false);

void sig_int_handler(int) {
    stop_signal_called = true;
}

// Configuration structure
struct RecorderConfig {
    double freq = 915.0e6;        // Center frequency (Hz)
    double rate = 10.0e6;         // Sample rate (Hz)
    double gain = 50.0;           // RX gain (dB)
    double duration = 10.0;       // Recording duration (seconds)
    std::string output_file = "recording.sigmf-data";
    std::string device_args = ""; // UHD device args
    std::string subdev = "A:A";   // Subdevice spec
    std::string ant = "TX/RX";    // Antenna
    double bw = 0.0;              // Analog bandwidth (0 = auto)
};

// Main recording function
int UHD_SAFE_MAIN(int argc, char* argv[]) {
    // Set thread priority
    uhd::set_thread_priority_safe();
    
    // Register signal handler
    std::signal(SIGINT, &sig_int_handler);
    std::signal(SIGTERM, &sig_int_handler);
    
    RecorderConfig config;
    
    // Parse command line arguments
    for (int i = 1; i < argc; i += 2) {
        if (i + 1 >= argc) break;
        std::string arg = argv[i];
        std::string val = argv[i + 1];
        
        if (arg == "--freq") config.freq = std::stod(val) * 1e6;
        else if (arg == "--rate") config.rate = std::stod(val) * 1e6;
        else if (arg == "--gain") config.gain = std::stod(val);
        else if (arg == "--duration") config.duration = std::stod(val);
        else if (arg == "--output") config.output_file = val;
        else if (arg == "--device") config.device_args = val;
        else if (arg == "--subdev") config.subdev = val;
        else if (arg == "--ant") config.ant = val;
        else if (arg == "--bw") config.bw = std::stod(val) * 1e6;
    }
    
    std::cerr << "[IQ Recorder] Initializing USRP..." << std::endl;
    
    // Create USRP device
    uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make(config.device_args);
    
    // Set subdevice spec
    usrp->set_rx_subdev_spec(config.subdev);
    
    // Set sample rate
    usrp->set_rx_rate(config.rate);
    double actual_rate = usrp->get_rx_rate();
    std::cerr << "[IQ Recorder] Sample rate: " << (actual_rate / 1e6) << " MSPS" << std::endl;
    
    // Set center frequency
    uhd::tune_request_t tune_request(config.freq);
    usrp->set_rx_freq(tune_request);
    double actual_freq = usrp->get_rx_freq();
    std::cerr << "[IQ Recorder] Center frequency: " << (actual_freq / 1e6) << " MHz" << std::endl;
    
    // Set gain
    usrp->set_rx_gain(config.gain);
    double actual_gain = usrp->get_rx_gain();
    std::cerr << "[IQ Recorder] RX gain: " << actual_gain << " dB" << std::endl;
    
    // Set antenna
    usrp->set_rx_antenna(config.ant);
    
    // Set bandwidth
    if (config.bw > 0.0) {
        usrp->set_rx_bandwidth(config.bw);
    }
    
    // Create RX streamer
    uhd::stream_args_t stream_args("fc32", "sc16");
    uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);
    
    // Calculate total samples to record
    size_t total_samples = static_cast<size_t>(config.duration * actual_rate);
    std::cerr << "[IQ Recorder] Recording " << total_samples << " samples (" 
              << config.duration << " seconds)" << std::endl;
    std::cerr << "[IQ Recorder] Output file: " << config.output_file << std::endl;
    
    // Open output file
    std::ofstream outfile(config.output_file, std::ios::binary);
    if (!outfile.is_open()) {
        std::cerr << "[IQ Recorder] ERROR: Failed to open output file" << std::endl;
        return EXIT_FAILURE;
    }
    
    // Start streaming
    uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
    stream_cmd.stream_now = true;
    rx_stream->issue_stream_cmd(stream_cmd);
    
    std::cerr << "[IQ Recorder] Recording started..." << std::endl;
    
    // Allocate receive buffer (1024 samples at a time)
    const size_t buffer_size = 1024;
    std::vector<std::complex<float>> buffer(buffer_size);
    uhd::rx_metadata_t md;
    
    size_t samples_recorded = 0;
    size_t overflows = 0;
    auto start_time = std::chrono::steady_clock::now();
    auto last_progress_time = start_time;
    
    // Main recording loop
    while (samples_recorded < total_samples && !stop_signal_called) {
        size_t samples_to_recv = std::min(buffer_size, total_samples - samples_recorded);
        
        // Receive samples
        size_t num_rx_samps = rx_stream->recv(&buffer.front(), samples_to_recv, md, 3.0);
        
        // Check for errors
        if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_TIMEOUT) {
            std::cerr << "[IQ Recorder] WARNING: Timeout waiting for samples" << std::endl;
            continue;
        }
        if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_OVERFLOW) {
            overflows++;
            if (overflows % 100 == 0) {
                std::cerr << "[IQ Recorder] WARNING: Overflow detected (" << overflows << " total)" << std::endl;
            }
            continue;
        }
        if (md.error_code != uhd::rx_metadata_t::ERROR_CODE_NONE) {
            std::cerr << "[IQ Recorder] ERROR: " << md.strerror() << std::endl;
            break;
        }
        
        // Write samples to file
        outfile.write(reinterpret_cast<const char*>(buffer.data()), 
                      num_rx_samps * sizeof(std::complex<float>));
        
        samples_recorded += num_rx_samps;
        
        // Progress reporting (every second)
        auto now = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::seconds>(now - last_progress_time).count() >= 1) {
            double progress = 100.0 * samples_recorded / total_samples;
            double elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - start_time).count() / 1000.0;
            double rate_mbps = (samples_recorded * sizeof(std::complex<float>) / (1024.0 * 1024.0)) / elapsed;
            
            std::cerr << "[IQ Recorder] Progress: " << std::fixed << std::setprecision(1) 
                      << progress << "% (" << samples_recorded << "/" << total_samples 
                      << " samples, " << rate_mbps << " MB/s)" << std::endl;
            
            last_progress_time = now;
        }
    }
    
    // Stop streaming
    stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
    rx_stream->issue_stream_cmd(stream_cmd);
    
    // Close output file
    outfile.close();
    
    // Final statistics
    auto end_time = std::chrono::steady_clock::now();
    double total_time = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count() / 1000.0;
    double file_size_mb = (samples_recorded * sizeof(std::complex<float>)) / (1024.0 * 1024.0);
    
    std::cerr << "\n[IQ Recorder] Recording complete!" << std::endl;
    std::cerr << "  Samples recorded: " << samples_recorded << std::endl;
    std::cerr << "  Duration: " << std::fixed << std::setprecision(2) << total_time << " seconds" << std::endl;
    std::cerr << "  File size: " << std::fixed << std::setprecision(2) << file_size_mb << " MB" << std::endl;
    std::cerr << "  Overflows: " << overflows << std::endl;
    
    if (stop_signal_called) {
        std::cerr << "  Note: Recording stopped early by user" << std::endl;
    }
    
    return EXIT_SUCCESS;
}
