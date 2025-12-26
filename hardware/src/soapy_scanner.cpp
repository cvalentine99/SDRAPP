/**
 * SoapySDR Frequency Scanner
 * 
 * Scans frequency ranges using SoapySDR-compatible devices
 * Outputs JSON results to stdout
 * 
 * Compile: g++ -o soapy_scanner soapy_scanner.cpp -lSoapySDR -lfftw3f -std=c++17
 */

#include <SoapySDR/Device.hpp>
#include <SoapySDR/Formats.hpp>
#include <fftw3.h>
#include <iostream>
#include <vector>
#include <complex>
#include <cmath>
#include <algorithm>
#include <iomanip>

struct ScanConfig {
    std::string device_args;
    double start_freq;
    double stop_freq;
    double step_size;
    double sample_rate;
    double gain;
    size_t fft_size;
    int channel;
    double dwell_time_ms;
};

struct Peak {
    double frequency;
    float power_db;
    float bandwidth;
};

std::vector<Peak> find_peaks(const std::vector<float>& fft_data, double center_freq, 
                              double sample_rate, float threshold_db = -80.0) {
    std::vector<Peak> peaks;
    const size_t fft_size = fft_data.size();
    const double freq_resolution = sample_rate / fft_size;

    for (size_t i = 5; i < fft_size - 5; ++i) {
        float power_db = 20.0f * std::log10(fft_data[i] + 1e-10f);
        
        if (power_db < threshold_db) continue;

        // Check if local maximum
        bool is_peak = true;
        for (int j = -2; j <= 2; ++j) {
            if (j == 0) continue;
            if (fft_data[i] < fft_data[i + j]) {
                is_peak = false;
                break;
            }
        }

        if (is_peak) {
            double freq = center_freq - sample_rate / 2.0 + i * freq_resolution;
            
            // Estimate bandwidth (3dB down)
            float threshold_3db = fft_data[i] * 0.707f;
            size_t bw_left = i, bw_right = i;
            
            while (bw_left > 0 && fft_data[bw_left] > threshold_3db) bw_left--;
            while (bw_right < fft_size - 1 && fft_data[bw_right] > threshold_3db) bw_right++;
            
            float bandwidth = (bw_right - bw_left) * freq_resolution;

            peaks.push_back({freq, power_db, bandwidth});
        }
    }

    return peaks;
}

int main(int argc, char* argv[]) {
    ScanConfig config;
    config.device_args = "";
    config.start_freq = 88.0e6;    // 88 MHz
    config.stop_freq = 108.0e6;    // 108 MHz
    config.step_size = 2.0e6;      // 2 MHz steps
    config.sample_rate = 2.0e6;    // 2 MSPS
    config.gain = 20.0;
    config.fft_size = 2048;
    config.channel = 0;
    config.dwell_time_ms = 100;

    // Parse arguments
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--start" && i + 1 < argc) {
            config.start_freq = std::stod(argv[++i]);
        } else if (arg == "--stop" && i + 1 < argc) {
            config.stop_freq = std::stod(argv[++i]);
        } else if (arg == "--step" && i + 1 < argc) {
            config.step_size = std::stod(argv[++i]);
        } else if (arg == "--rate" && i + 1 < argc) {
            config.sample_rate = std::stod(argv[++i]);
        } else if (arg == "--gain" && i + 1 < argc) {
            config.gain = std::stod(argv[++i]);
        } else if (arg == "--device" && i + 1 < argc) {
            config.device_args = argv[++i];
        } else if (arg == "--dwell" && i + 1 < argc) {
            config.dwell_time_ms = std::stod(argv[++i]);
        }
    }

    try {
        // Open device
        std::cerr << "[SOAPY-SCANNER] Opening device: " << config.device_args << std::endl;
        SoapySDR::Device *device = SoapySDR::Device::make(config.device_args);
        if (!device) {
            std::cerr << "[SOAPY-SCANNER] Failed to open device" << std::endl;
            return 1;
        }

        // Configure device
        device->setSampleRate(SOAPY_SDR_RX, config.channel, config.sample_rate);
        device->setGain(SOAPY_SDR_RX, config.channel, config.gain);

        // Setup stream
        std::vector<size_t> channels = {(size_t)config.channel};
        SoapySDR::Stream *stream = device->setupStream(SOAPY_SDR_RX, SOAPY_SDR_CF32, channels);
        device->activateStream(stream);

        // Allocate buffers
        std::vector<std::complex<float>> samples(config.fft_size);
        std::vector<float> fft_magnitude(config.fft_size);

        // Setup FFTW
        fftwf_complex *fft_in = fftwf_alloc_complex(config.fft_size);
        fftwf_complex *fft_out = fftwf_alloc_complex(config.fft_size);
        fftwf_plan plan = fftwf_plan_dft_1d(config.fft_size, fft_in, fft_out, 
                                            FFTW_FORWARD, FFTW_ESTIMATE);

        std::vector<Peak> all_peaks;
        double current_freq = config.start_freq;

        std::cerr << "[SOAPY-SCANNER] Scanning " << config.start_freq / 1e6 << " MHz to " 
                  << config.stop_freq / 1e6 << " MHz" << std::endl;

        // Scan loop
        while (current_freq <= config.stop_freq) {
            device->setFrequency(SOAPY_SDR_RX, config.channel, current_freq);
            
            // Allow settling time
            std::this_thread::sleep_for(std::chrono::milliseconds((int)config.dwell_time_ms));

            // Read samples
            void *buffs[] = {samples.data()};
            int flags = 0;
            long long time_ns = 0;
            
            int ret = device->readStream(stream, buffs, config.fft_size, flags, time_ns, 1000000);
            
            if (ret == (int)config.fft_size) {
                // Compute FFT
                for (size_t i = 0; i < config.fft_size; ++i) {
                    fft_in[i][0] = samples[i].real();
                    fft_in[i][1] = samples[i].imag();
                }

                fftwf_execute(plan);

                // Calculate magnitude with FFT shift
                for (size_t i = 0; i < config.fft_size; ++i) {
                    size_t shifted_idx = (i + config.fft_size / 2) % config.fft_size;
                    float real = fft_out[shifted_idx][0];
                    float imag = fft_out[shifted_idx][1];
                    fft_magnitude[i] = std::sqrt(real * real + imag * imag) / config.fft_size;
                }

                // Find peaks
                auto peaks = find_peaks(fft_magnitude, current_freq, config.sample_rate);
                all_peaks.insert(all_peaks.end(), peaks.begin(), peaks.end());
            }

            current_freq += config.step_size;
        }

        // Cleanup
        device->deactivateStream(stream);
        device->closeStream(stream);
        fftwf_destroy_plan(plan);
        fftwf_free(fft_in);
        fftwf_free(fft_out);
        SoapySDR::Device::unmake(device);

        // Sort peaks by power
        std::sort(all_peaks.begin(), all_peaks.end(), 
                  [](const Peak& a, const Peak& b) { return a.power_db > b.power_db; });

        // Output JSON
        std::cout << "{\"peaks\":[";
        for (size_t i = 0; i < all_peaks.size(); ++i) {
            if (i > 0) std::cout << ",";
            std::cout << "{\"frequency\":" << std::fixed << std::setprecision(0) << all_peaks[i].frequency
                      << ",\"powerDb\":" << std::fixed << std::setprecision(2) << all_peaks[i].power_db
                      << ",\"bandwidth\":" << std::fixed << std::setprecision(0) << all_peaks[i].bandwidth
                      << "}";
        }
        std::cout << "],\"scanRange\":{\"start\":" << config.start_freq 
                  << ",\"stop\":" << config.stop_freq << "}}" << std::endl;

        std::cerr << "[SOAPY-SCANNER] Found " << all_peaks.size() << " peaks" << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "[SOAPY-SCANNER] Error: " << e.what() << std::endl;
        return 1;
    }

    return 0;
}
