/**
 * SDR Device Enumerator
 * 
 * Lists all available SDR devices (UHD and SoapySDR)
 * Outputs JSON to stdout
 * 
 * Compile: g++ -o device_enumerator device_enumerator.cpp -lSoapySDR -luhd -std=c++17
 */

#include <iostream>
#include <vector>
#include <string>
#include <sstream>

// Conditional includes based on available libraries
#ifdef HAS_SOAPYSDR
#include <SoapySDR/Device.hpp>
#include <SoapySDR/Types.hpp>
#endif

#ifdef HAS_UHD
#include <uhd/device.hpp>
#include <uhd/types/device_addr.hpp>
#endif

struct DeviceInfo {
    std::string backend;      // "uhd" or "soapysdr"
    std::string driver;       // "b200", "rtlsdr", "hackrf", etc.
    std::string hardware;     // Hardware name
    std::string serial;       // Serial number
    std::string args;         // Device arguments string
};

std::vector<DeviceInfo> enumerate_devices() {
    std::vector<DeviceInfo> devices;

#ifdef HAS_UHD
    // Enumerate UHD devices
    try {
        uhd::device_addrs_t uhd_devices = uhd::device::find(std::string(""));
        for (const auto& dev : uhd_devices) {
            DeviceInfo info;
            info.backend = "uhd";
            info.driver = dev.get("type", "unknown");
            info.hardware = dev.get("product", "UHD Device");
            info.serial = dev.get("serial", "");
            
            // Build args string
            std::ostringstream args_ss;
            args_ss << "type=" << info.driver;
            if (!info.serial.empty()) {
                args_ss << ",serial=" << info.serial;
            }
            info.args = args_ss.str();
            
            devices.push_back(info);
        }
    } catch (const std::exception& e) {
        std::cerr << "[ENUMERATOR] UHD enumeration error: " << e.what() << std::endl;
    }
#endif

#ifdef HAS_SOAPYSDR
    // Enumerate SoapySDR devices
    try {
        SoapySDR::KwargsList soapy_devices = SoapySDR::Device::enumerate();
        for (const auto& dev : soapy_devices) {
            DeviceInfo info;
            info.backend = "soapysdr";
            
            // Extract driver
            auto driver_it = dev.find("driver");
            info.driver = (driver_it != dev.end()) ? driver_it->second : "unknown";
            
            // Extract hardware name
            auto hw_it = dev.find("label");
            if (hw_it == dev.end()) hw_it = dev.find("product");
            info.hardware = (hw_it != dev.end()) ? hw_it->second : "SoapySDR Device";
            
            // Extract serial
            auto serial_it = dev.find("serial");
            info.serial = (serial_it != dev.end()) ? serial_it->second : "";
            
            // Build args string
            std::ostringstream args_ss;
            args_ss << "driver=" << info.driver;
            if (!info.serial.empty()) {
                args_ss << ",serial=" << info.serial;
            }
            info.args = args_ss.str();
            
            devices.push_back(info);
        }
    } catch (const std::exception& e) {
        std::cerr << "[ENUMERATOR] SoapySDR enumeration error: " << e.what() << std::endl;
    }
#endif

    return devices;
}

int main() {
    auto devices = enumerate_devices();

    // Output JSON
    std::cout << "{\"devices\":[";
    for (size_t i = 0; i < devices.size(); ++i) {
        if (i > 0) std::cout << ",";
        std::cout << "{"
                  << "\"backend\":\"" << devices[i].backend << "\","
                  << "\"driver\":\"" << devices[i].driver << "\","
                  << "\"hardware\":\"" << devices[i].hardware << "\","
                  << "\"serial\":\"" << devices[i].serial << "\","
                  << "\"args\":\"" << devices[i].args << "\""
                  << "}";
    }
    std::cout << "]}" << std::endl;

    std::cerr << "[ENUMERATOR] Found " << devices.size() << " device(s)" << std::endl;

    return 0;
}
