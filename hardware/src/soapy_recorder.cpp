/**
 * SoapySDR IQ Recorder
 * 
 * Records IQ samples from SoapySDR-compatible devices to binary file with SigMF metadata
 * 
 * Compile: g++ -o soapy_recorder soapy_recorder.cpp -lSoapySDR -std=c++17
 */

#include <SoapySDR/Device.hpp>
#include <SoapySDR/Formats.hpp>
#include <iostream>
#include <fstream>
#include <vector>
#include <complex>
#include <ctime>
#include <iomanip>
#include <sstream>

struct RecordConfig {
    std::string device_args;
    double center_freq;
    double sample_rate;
    double gain;
    size_t num_samples;
    std::string output_file;
    int channel;
};

std::string get_iso8601_timestamp() {
    auto now = std::time(nullptr);
    auto tm = *std::gmtime(&now);
    std::ostringstream oss;
    oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

void write_sigmf_metadata(const std::string& filename, const RecordConfig& config, 
                           const std::string& hw_info) {
    std::string meta_filename = filename + ".sigmf-meta";
    std::ofstream meta_file(meta_filename);
    
    if (!meta_file.is_open()) {
        std::cerr << "[SOAPY-RECORDER] Failed to create metadata file" << std::endl;
        return;
    }

    std::string timestamp = get_iso8601_timestamp();

    meta_file << "{\n";
    meta_file << "  \"global\": {\n";
    meta_file << "    \"core:datatype\": \"cf32_le\",\n";
    meta_file << "    \"core:sample_rate\": " << config.sample_rate << ",\n";
    meta_file << "    \"core:version\": \"1.0.0\",\n";
    meta_file << "    \"core:description\": \"IQ recording from SoapySDR device\",\n";
    meta_file << "    \"core:author\": \"Ettus SDR Web App\",\n";
    meta_file << "    \"core:recorder\": \"soapy_recorder\",\n";
    meta_file << "    \"core:hw\": \"" << hw_info << "\"\n";
    meta_file << "  },\n";
    meta_file << "  \"captures\": [\n";
    meta_file << "    {\n";
    meta_file << "      \"core:sample_start\": 0,\n";
    meta_file << "      \"core:frequency\": " << config.center_freq << ",\n";
    meta_file << "      \"core:datetime\": \"" << timestamp << "\"\n";
    meta_file << "    }\n";
    meta_file << "  ],\n";
    meta_file << "  \"annotations\": []\n";
    meta_file << "}\n";

    meta_file.close();
    std::cerr << "[SOAPY-RECORDER] Metadata written to " << meta_filename << std::endl;
}

int main(int argc, char* argv[]) {
    RecordConfig config;
    config.device_args = "";
    config.center_freq = 2.4e9;
    config.sample_rate = 2.0e6;
    config.gain = 20.0;
    config.num_samples = 10000000;  // 10M samples default (5 seconds at 2 MSPS)
    config.output_file = "/tmp/recording.sigmf-data";
    config.channel = 0;

    // Parse arguments
    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--freq" && i + 1 < argc) {
            config.center_freq = std::stod(argv[++i]);
        } else if (arg == "--rate" && i + 1 < argc) {
            config.sample_rate = std::stod(argv[++i]);
        } else if (arg == "--gain" && i + 1 < argc) {
            config.gain = std::stod(argv[++i]);
        } else if (arg == "--samples" && i + 1 < argc) {
            config.num_samples = std::stoull(argv[++i]);
        } else if (arg == "--output" && i + 1 < argc) {
            config.output_file = argv[++i];
        } else if (arg == "--device" && i + 1 < argc) {
            config.device_args = argv[++i];
        }
    }

    try {
        // Open device
        std::cerr << "[SOAPY-RECORDER] Opening device: " << config.device_args << std::endl;
        SoapySDR::Device *device = SoapySDR::Device::make(config.device_args);
        if (!device) {
            std::cerr << "[SOAPY-RECORDER] Failed to open device" << std::endl;
            return 1;
        }

        std::string hw_info = device->getHardwareKey() + " (" + device->getDriverKey() + ")";
        std::cerr << "[SOAPY-RECORDER] Device: " << hw_info << std::endl;

        // Configure device
        device->setSampleRate(SOAPY_SDR_RX, config.channel, config.sample_rate);
        device->setFrequency(SOAPY_SDR_RX, config.channel, config.center_freq);
        device->setGain(SOAPY_SDR_RX, config.channel, config.gain);

        // Setup stream
        std::vector<size_t> channels = {(size_t)config.channel};
        SoapySDR::Stream *stream = device->setupStream(SOAPY_SDR_RX, SOAPY_SDR_CF32, channels);
        device->activateStream(stream);

        // Open output file
        std::ofstream data_file(config.output_file, std::ios::binary);
        if (!data_file.is_open()) {
            std::cerr << "[SOAPY-RECORDER] Failed to open output file" << std::endl;
            SoapySDR::Device::unmake(device);
            return 1;
        }

        std::cerr << "[SOAPY-RECORDER] Recording " << config.num_samples << " samples to " 
                  << config.output_file << std::endl;

        // Allocate buffer (read in chunks)
        const size_t chunk_size = 16384;
        std::vector<std::complex<float>> buffer(chunk_size);
        size_t samples_recorded = 0;

        // Recording loop
        while (samples_recorded < config.num_samples) {
            size_t samples_to_read = std::min(chunk_size, config.num_samples - samples_recorded);
            
            void *buffs[] = {buffer.data()};
            int flags = 0;
            long long time_ns = 0;
            
            int ret = device->readStream(stream, buffs, samples_to_read, flags, time_ns, 1000000);
            
            if (ret < 0) {
                std::cerr << "[SOAPY-RECORDER] Stream error: " << ret << std::endl;
                break;
            }

            if (ret > 0) {
                data_file.write(reinterpret_cast<const char*>(buffer.data()), 
                                ret * sizeof(std::complex<float>));
                samples_recorded += ret;

                // Progress update every 1M samples
                if (samples_recorded % 1000000 == 0) {
                    std::cerr << "[SOAPY-RECORDER] Progress: " << samples_recorded << " / " 
                              << config.num_samples << " samples" << std::endl;
                }
            }
        }

        // Cleanup
        data_file.close();
        device->deactivateStream(stream);
        device->closeStream(stream);
        SoapySDR::Device::unmake(device);

        // Write SigMF metadata
        write_sigmf_metadata(config.output_file, config, hw_info);

        // Output JSON result
        std::cout << "{\"success\":true,\"samplesRecorded\":" << samples_recorded 
                  << ",\"dataFile\":\"" << config.output_file 
                  << "\",\"metaFile\":\"" << config.output_file << ".sigmf-meta\"}" << std::endl;

        std::cerr << "[SOAPY-RECORDER] Recording complete: " << samples_recorded << " samples" << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "[SOAPY-RECORDER] Error: " << e.what() << std::endl;
        std::cout << "{\"success\":false,\"error\":\"" << e.what() << "\"}" << std::endl;
        return 1;
    }

    return 0;
}
