/**
 * SoapySDR FFT Streamer
 * 
 * Streams real-time FFT data from SoapySDR-compatible devices (RTL-SDR, HackRF, LimeSDR, etc.)
 * Outputs JSON to stdout for consumption by Node.js WebSocket server.
 * 
 * Compile: g++ -o soapy_streamer soapy_streamer.cpp -lSoapySDR -lfftw3f -std=c++17
 */

#include <SoapySDR/Device.hpp>
#include <SoapySDR/Formats.hpp>
#include <SoapySDR/Types.hpp>
#include <fftw3.h>
#include <iostream>
#include <vector>
#include <complex>
#include <cmath>
#include <csignal>
#include <chrono>
#include <thread>
#include <iomanip>

// Global flag for graceful shutdown
volatile bool running = true;

void signal_handler(int signum) {
    std::cerr << "[SOAPY-STREAMER] Received signal " << signum << ", shutting down..." << std::endl;
    running = false;
}

struct Config {
    std::string device_args;
    double center_freq;
    double sample_rate;
    double gain;
    size_t fft_size;
    int channel;
    std::string antenna;
};

void print_json_fft(const std::vector<float>& fft_data, double center_freq, double sample_rate) {
    std::cout << "{\"type\":\"fft\",\"data\":[";
    for (size_t i = 0; i < fft_data.size(); ++i) {
        if (i > 0) std::cout << ",";
        std::cout << std::fixed << std::setprecision(6) << fft_data[i];
    }
    std::cout << "],\"centerFreq\":" << std::fixed << std::setprecision(0) << center_freq
              << ",\"sampleRate\":" << std::fixed << std::setprecision(0) << sample_rate
              << ",\"timestamp\":" << std::chrono::duration_cast<std::chrono::milliseconds>(
                     std::chrono::system_clock::now().time_since_epoch()).count()
              << "}" << std::endl;
}

int main(int argc, char* argv[]) {
    // Parse command line arguments
    Config config;
    config.device_args = "";
    config.center_freq = 2.4e9;  // 2.4 GHz default
    config.sample_rate = 2.0e6;  // 2 MSPS default
    config.gain = 20.0;          // 20 dB default
    config.fft_size = 2048;      // 2048 bins default
    config.channel = 0;
    config.antenna = "RX";

    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--freq" && i + 1 < argc) {
            config.center_freq = std::stod(argv[++i]);
        } else if (arg == "--rate" && i + 1 < argc) {
            config.sample_rate = std::stod(argv[++i]);
        } else if (arg == "--gain" && i + 1 < argc) {
            config.gain = std::stod(argv[++i]);
        } else if (arg == "--fft-size" && i + 1 < argc) {
            config.fft_size = std::stoul(argv[++i]);
        } else if (arg == "--device" && i + 1 < argc) {
            config.device_args = argv[++i];
        } else if (arg == "--antenna" && i + 1 < argc) {
            config.antenna = argv[++i];
        }
    }

    // Install signal handlers
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    try {
        // Create device
        std::cerr << "[SOAPY-STREAMER] Opening device: " << config.device_args << std::endl;
        SoapySDR::Device *device = SoapySDR::Device::make(config.device_args);
        if (!device) {
            std::cerr << "[SOAPY-STREAMER] Failed to open device" << std::endl;
            return 1;
        }

        // Print device info
        std::cerr << "[SOAPY-STREAMER] Device: " << device->getHardwareKey() << std::endl;
        std::cerr << "[SOAPY-STREAMER] Driver: " << device->getDriverKey() << std::endl;

        // Configure device
        device->setSampleRate(SOAPY_SDR_RX, config.channel, config.sample_rate);
        device->setFrequency(SOAPY_SDR_RX, config.channel, config.center_freq);
        
        // Set gain (try automatic first, then manual)
        if (device->hasGainMode(SOAPY_SDR_RX, config.channel)) {
            device->setGainMode(SOAPY_SDR_RX, config.channel, false);
        }
        device->setGain(SOAPY_SDR_RX, config.channel, config.gain);

        // Set antenna if supported
        auto antennas = device->listAntennas(SOAPY_SDR_RX, config.channel);
        if (!antennas.empty()) {
            device->setAntenna(SOAPY_SDR_RX, config.channel, config.antenna);
        }

        // Setup stream
        std::vector<size_t> channels = {(size_t)config.channel};
        SoapySDR::Stream *stream = device->setupStream(SOAPY_SDR_RX, SOAPY_SDR_CF32, channels);
        if (!stream) {
            std::cerr << "[SOAPY-STREAMER] Failed to setup stream" << std::endl;
            SoapySDR::Device::unmake(device);
            return 1;
        }

        device->activateStream(stream);

        // Allocate buffers
        std::vector<std::complex<float>> samples(config.fft_size);
        std::vector<float> fft_magnitude(config.fft_size);

        // Setup FFTW
        fftwf_complex *fft_in = fftwf_alloc_complex(config.fft_size);
        fftwf_complex *fft_out = fftwf_alloc_complex(config.fft_size);
        fftwf_plan plan = fftwf_plan_dft_1d(config.fft_size, fft_in, fft_out, 
                                            FFTW_FORWARD, FFTW_ESTIMATE);

        std::cerr << "[SOAPY-STREAMER] Streaming started (Ctrl+C to stop)" << std::endl;

        // Main streaming loop
        while (running) {
            // Read samples
            void *buffs[] = {samples.data()};
            int flags = 0;
            long long time_ns = 0;
            
            int ret = device->readStream(stream, buffs, config.fft_size, flags, time_ns, 1000000);
            
            if (ret < 0) {
                std::cerr << "[SOAPY-STREAMER] Stream error: " << ret << std::endl;
                continue;
            }

            if (ret != (int)config.fft_size) {
                continue; // Incomplete read, skip FFT
            }

            // Copy samples to FFT input
            for (size_t i = 0; i < config.fft_size; ++i) {
                fft_in[i][0] = samples[i].real();
                fft_in[i][1] = samples[i].imag();
            }

            // Compute FFT
            fftwf_execute(plan);

            // Calculate magnitude and FFT shift
            for (size_t i = 0; i < config.fft_size; ++i) {
                size_t shifted_idx = (i + config.fft_size / 2) % config.fft_size;
                float real = fft_out[shifted_idx][0];
                float imag = fft_out[shifted_idx][1];
                float magnitude = std::sqrt(real * real + imag * imag) / config.fft_size;
                fft_magnitude[i] = magnitude;
            }

            // Output JSON
            print_json_fft(fft_magnitude, config.center_freq, config.sample_rate);

            // Throttle to ~30 FPS
            std::this_thread::sleep_for(std::chrono::milliseconds(33));
        }

        // Cleanup
        device->deactivateStream(stream);
        device->closeStream(stream);
        fftwf_destroy_plan(plan);
        fftwf_free(fft_in);
        fftwf_free(fft_out);
        SoapySDR::Device::unmake(device);

        std::cerr << "[SOAPY-STREAMER] Shutdown complete" << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "[SOAPY-STREAMER] Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
