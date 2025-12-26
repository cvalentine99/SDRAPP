/**
 * sdr_streamer.cpp - SoapySDR-based SDR Streaming Daemon
 *
 * Compatible with SignalSDR Pro, USRP B210, and other SoapySDR-supported devices
 *
 * Features:
 * - Binary FFT output mode (--binary) for 70% bandwidth reduction
 * - Shared memory output mode (--shm) for zero-copy IPC
 * - Dual-channel mode (--channels 2) for MIMO/diversity reception
 * - Runtime parameter control via Unix domain socket (no restart required)
 * - JSON FFT output mode for backward compatibility
 */

#include <SoapySDR/Device.hpp>
#include <SoapySDR/Types.hpp>
#include <SoapySDR/Formats.hpp>
#include <SoapySDR/Errors.hpp>
#include <SoapySDR/Version.hpp>
#include <fftw3.h>
#include <boost/program_options.hpp>
#include <boost/format.hpp>
#include <iostream>
#include <fstream>
#include <csignal>
#include <complex>
#include <vector>
#include <array>
#include <cmath>
#include <chrono>
#include <iomanip>
#include <thread>
#include <atomic>
#include <mutex>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>

// Shared memory FFT buffer for zero-copy IPC
#include "shared_fft_buffer.hpp"

namespace po = boost::program_options;

// ============================================================================
// Global state
// ============================================================================

static std::atomic<bool> stop_signal_called{false};
static std::atomic<double> current_frequency{915e6};
static std::atomic<double> current_gain{50.0};
static std::atomic<double> current_sample_rate{10e6};
static SoapySDR::Device* g_device = nullptr;
static std::mutex g_device_mutex;

void sig_int_handler(int) {
    stop_signal_called = true;
}

// ============================================================================
// Hardware limits (generic for B210-compatible devices)
// ============================================================================

constexpr double MIN_FREQ = 50e6;       // 50 MHz
constexpr double MAX_FREQ = 6000e6;     // 6000 MHz
constexpr double MIN_RX_GAIN = 0.0;     // 0 dB
constexpr double MAX_RX_GAIN = 76.0;    // 76 dB
constexpr double MIN_BW = 200e3;        // 200 kHz
constexpr double MAX_BW = 56e6;         // 56 MHz

// ============================================================================
// Binary protocol structures (packed for wire format)
// ============================================================================

#pragma pack(push, 1)

// Binary FFT frame header
struct BinaryFFTHeader {
    uint32_t magic;           // 0x46465431 ("FFT1")
    uint32_t frame_number;
    double   timestamp;
    double   center_freq;
    double   sample_rate;
    uint16_t fft_size;
    uint16_t flags;           // Bit 0: GPS locked, Bit 1: Overflow
    int16_t  peak_bin;
    float    peak_power;
};

// Binary status frame
struct BinaryStatusFrame {
    uint32_t magic;           // 0x53545431 ("STT1")
    uint32_t frame_count;
    float    rx_temp;
    float    tx_temp;
    uint8_t  gps_locked;
    uint8_t  pll_locked;
    uint16_t reserved;
    double   gps_servo;
    char     gps_time[32];
};

// Control socket command (9 bytes)
struct ControlCommand {
    enum Type : uint8_t {
        SET_FREQUENCY = 1,
        SET_SAMPLE_RATE = 2,
        SET_GAIN = 3,
        SET_BANDWIDTH = 4,
        GET_STATUS = 10,
        PING = 11,
        STOP = 255
    };
    Type type;
    double value;
};

// Control socket response (73 bytes)
struct ControlResponse {
    uint8_t success;
    double actual_value;
    char message[64];
};

#pragma pack(pop)

// ============================================================================
// Control socket server thread
// ============================================================================

constexpr char CONTROL_SOCKET_PATH[] = "/tmp/sdr_streamer.sock";

void control_socket_thread() {
    // Create Unix domain socket
    int server_fd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (server_fd < 0) {
        std::cerr << "[Control] Failed to create socket: " << strerror(errno) << std::endl;
        return;
    }

    // Set non-blocking for accept with timeout
    int flags = fcntl(server_fd, F_GETFL, 0);
    fcntl(server_fd, F_SETFL, flags | O_NONBLOCK);

    sockaddr_un addr{};
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, CONTROL_SOCKET_PATH, sizeof(addr.sun_path) - 1);

    // Remove any existing socket file
    unlink(CONTROL_SOCKET_PATH);

    if (bind(server_fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
        std::cerr << "[Control] Failed to bind socket: " << strerror(errno) << std::endl;
        close(server_fd);
        return;
    }

    if (listen(server_fd, 5) < 0) {
        std::cerr << "[Control] Failed to listen: " << strerror(errno) << std::endl;
        close(server_fd);
        return;
    }

    std::cerr << "[Control] Socket listening at " << CONTROL_SOCKET_PATH << std::endl;

    while (!stop_signal_called) {
        // Poll for incoming connections with timeout
        pollfd pfd{};
        pfd.fd = server_fd;
        pfd.events = POLLIN;

        int ready = poll(&pfd, 1, 1000);  // 1 second timeout
        if (ready <= 0) continue;

        int client_fd = accept(server_fd, nullptr, nullptr);
        if (client_fd < 0) continue;

        std::cerr << "[Control] Client connected" << std::endl;

        // Handle commands from this client
        ControlCommand cmd;
        while (!stop_signal_called) {
            ssize_t bytes = recv(client_fd, &cmd, sizeof(cmd), 0);
            if (bytes != sizeof(cmd)) break;

            ControlResponse resp{};
            resp.success = 1;

            try {
                std::lock_guard<std::mutex> lock(g_device_mutex);
                if (!g_device) {
                    resp.success = 0;
                    snprintf(resp.message, sizeof(resp.message), "Device not available");
                    send(client_fd, &resp, sizeof(resp), 0);
                    continue;
                }

                switch (cmd.type) {
                    case ControlCommand::SET_FREQUENCY:
                        if (cmd.value >= MIN_FREQ && cmd.value <= MAX_FREQ) {
                            g_device->setFrequency(SOAPY_SDR_RX, 0, cmd.value);
                            resp.actual_value = g_device->getFrequency(SOAPY_SDR_RX, 0);
                            current_frequency.store(resp.actual_value);
                            snprintf(resp.message, sizeof(resp.message),
                                    "Frequency set to %.6f MHz", resp.actual_value / 1e6);
                            std::cerr << "[Control] " << resp.message << std::endl;
                        } else {
                            resp.success = 0;
                            snprintf(resp.message, sizeof(resp.message),
                                    "Frequency out of range [%.0f-%.0f MHz]",
                                    MIN_FREQ/1e6, MAX_FREQ/1e6);
                        }
                        break;

                    case ControlCommand::SET_GAIN:
                        if (cmd.value >= MIN_RX_GAIN && cmd.value <= MAX_RX_GAIN) {
                            g_device->setGain(SOAPY_SDR_RX, 0, cmd.value);
                            resp.actual_value = g_device->getGain(SOAPY_SDR_RX, 0);
                            current_gain.store(resp.actual_value);
                            snprintf(resp.message, sizeof(resp.message),
                                    "Gain set to %.1f dB", resp.actual_value);
                            std::cerr << "[Control] " << resp.message << std::endl;
                        } else {
                            resp.success = 0;
                            snprintf(resp.message, sizeof(resp.message),
                                    "Gain out of range [%.0f-%.0f dB]",
                                    MIN_RX_GAIN, MAX_RX_GAIN);
                        }
                        break;

                    case ControlCommand::SET_BANDWIDTH:
                        if (cmd.value >= MIN_BW && cmd.value <= MAX_BW) {
                            g_device->setBandwidth(SOAPY_SDR_RX, 0, cmd.value);
                            resp.actual_value = g_device->getBandwidth(SOAPY_SDR_RX, 0);
                            snprintf(resp.message, sizeof(resp.message),
                                    "Bandwidth set to %.2f MHz", resp.actual_value / 1e6);
                            std::cerr << "[Control] " << resp.message << std::endl;
                        } else {
                            resp.success = 0;
                            snprintf(resp.message, sizeof(resp.message),
                                    "Bandwidth out of range");
                        }
                        break;

                    case ControlCommand::GET_STATUS:
                        resp.actual_value = current_frequency.load();
                        snprintf(resp.message, sizeof(resp.message),
                                "Freq=%.3fMHz Gain=%.1fdB",
                                current_frequency.load() / 1e6,
                                current_gain.load());
                        break;

                    case ControlCommand::PING:
                        resp.actual_value = 0;
                        snprintf(resp.message, sizeof(resp.message), "pong");
                        break;

                    case ControlCommand::STOP:
                        stop_signal_called = true;
                        snprintf(resp.message, sizeof(resp.message), "Stopping...");
                        break;

                    default:
                        resp.success = 0;
                        snprintf(resp.message, sizeof(resp.message), "Unknown command");
                }
            } catch (const std::exception& e) {
                resp.success = 0;
                snprintf(resp.message, sizeof(resp.message), "Error: %.50s", e.what());
                std::cerr << "[Control] Error: " << e.what() << std::endl;
            }

            send(client_fd, &resp, sizeof(resp), 0);
        }

        close(client_fd);
        std::cerr << "[Control] Client disconnected" << std::endl;
    }

    close(server_fd);
    unlink(CONTROL_SOCKET_PATH);
    std::cerr << "[Control] Socket closed" << std::endl;
}

// ============================================================================
// Output functions
// ============================================================================

void output_json_fft(double timestamp, double freq, double rate, size_t fft_size,
                     float peak_power, size_t peak_bin, const std::vector<float>& power_db) {
    std::cout << "{\"type\":\"fft\",\"timestamp\":" << timestamp
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
}

void output_binary_fft(uint32_t frame_num, double timestamp, double freq, double rate,
                       size_t fft_size, int16_t peak_bin, float peak_power,
                       const std::vector<float>& power_db, bool gps_lock) {
    BinaryFFTHeader header{};
    header.magic = 0x46465431;  // "FFT1"
    header.frame_number = frame_num;
    header.timestamp = timestamp;
    header.center_freq = freq;
    header.sample_rate = rate;
    header.fft_size = static_cast<uint16_t>(fft_size);
    header.flags = gps_lock ? 0x0001 : 0x0000;
    header.peak_bin = peak_bin;
    header.peak_power = peak_power;

    // Write header
    fwrite(&header, sizeof(header), 1, stdout);
    // Write spectrum data
    fwrite(power_db.data(), sizeof(float), fft_size, stdout);
    fflush(stdout);
}

void output_json_status(size_t frame_count, float rx_temp, float tx_temp) {
    std::cout << "{\"type\":\"status\""
              << ",\"frames\":" << frame_count
              << ",\"gpsLocked\":false"
              << ",\"gpsTime\":\"N/A\""
              << ",\"gpsServo\":0"
              << ",\"rxTemp\":" << rx_temp
              << ",\"txTemp\":" << tx_temp
              << "}" << std::endl;
}

void output_binary_status(uint32_t frame_count, float rx_temp, float tx_temp) {
    BinaryStatusFrame status{};
    status.magic = 0x53545431;  // "STT1"
    status.frame_count = frame_count;
    status.rx_temp = rx_temp;
    status.tx_temp = tx_temp;
    status.gps_locked = 0;
    status.pll_locked = 1;
    status.reserved = 0;
    status.gps_servo = 0.0;
    strncpy(status.gps_time, "N/A", sizeof(status.gps_time) - 1);

    fwrite(&status, sizeof(status), 1, stdout);
    fflush(stdout);
}

// ============================================================================
// Main
// ============================================================================

int main(int argc, char *argv[]) {
    // Command line options
    std::string device_args, driver, ant;
    double freq, rate, gain, bw;
    size_t fft_size, num_channels;
    bool binary_mode, shm_mode;

    po::options_description desc("SoapySDR Streamer Options");
    desc.add_options()
        ("help", "help message")
        ("args", po::value<std::string>(&device_args)->default_value(""), "Device arguments")
        ("driver", po::value<std::string>(&driver)->default_value(""), "SoapySDR driver name (e.g., uhd, plutosdr)")
        ("freq", po::value<double>(&freq)->default_value(915e6), "RF center frequency in Hz")
        ("rate", po::value<double>(&rate)->default_value(10e6), "Sample rate in Hz")
        ("gain", po::value<double>(&gain)->default_value(50), "RX gain in dB")
        ("bw", po::value<double>(&bw)->default_value(10e6), "Analog bandwidth in Hz")
        ("ant", po::value<std::string>(&ant)->default_value(""), "Antenna selection (device-specific)")
        ("fft-size", po::value<size_t>(&fft_size)->default_value(2048), "FFT size")
        ("binary", po::value<bool>(&binary_mode)->default_value(false), "Use binary output format")
        ("shm", po::value<bool>(&shm_mode)->default_value(false), "Use shared memory output (zero-copy IPC)")
        ("channels", po::value<size_t>(&num_channels)->default_value(1), "Number of RX channels (1 or 2)")
    ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);

    if (vm.count("help")) {
        std::cout << desc << std::endl;
        return EXIT_SUCCESS;
    }

    // Validate parameters
    if (num_channels < 1 || num_channels > sdr::MAX_CHANNELS) {
        std::cerr << "Error: Channel count " << num_channels << " out of range [1-"
                  << sdr::MAX_CHANNELS << "]" << std::endl;
        return EXIT_FAILURE;
    }

    // Initialize atomic state
    current_frequency.store(freq);
    current_gain.store(gain);
    current_sample_rate.store(rate);

    std::cerr << "[SDR] SoapySDR Version: " << SoapySDR::getLibVersion() << std::endl;

    if (binary_mode) {
        std::cerr << "[SDR] Binary output mode enabled" << std::endl;
    }
    if (shm_mode) {
        std::cerr << "[SDR] Shared memory output mode enabled" << std::endl;
    }
    if (num_channels > 1) {
        std::cerr << "[SDR] Dual-channel mode enabled (" << num_channels << " channels)" << std::endl;
    }

    // ========================================================================
    // Enumerate and create SoapySDR device
    // ========================================================================

    std::cerr << "[SDR] Enumerating devices..." << std::endl;

    SoapySDR::KwargsList results = SoapySDR::Device::enumerate(device_args);
    if (results.empty()) {
        std::cerr << "Error: No SoapySDR devices found!" << std::endl;
        std::cerr << "  Try: SoapySDRUtil --find" << std::endl;
        return EXIT_FAILURE;
    }

    std::cerr << "[SDR] Found " << results.size() << " device(s):" << std::endl;
    for (size_t i = 0; i < results.size(); i++) {
        std::cerr << "  Device #" << i << ": ";
        for (auto& kv : results[i]) {
            std::cerr << kv.first << "=" << kv.second << " ";
        }
        std::cerr << std::endl;
    }

    // Create device (use first found or filter by driver if specified)
    SoapySDR::Kwargs args = results[0];
    if (!driver.empty()) {
        args["driver"] = driver;
    }

    std::cerr << "[SDR] Creating device..." << std::endl;
    SoapySDR::Device* device = SoapySDR::Device::make(args);
    if (device == nullptr) {
        std::cerr << "Error: Failed to create SoapySDR device!" << std::endl;
        return EXIT_FAILURE;
    }

    // Store global reference for control socket
    {
        std::lock_guard<std::mutex> lock(g_device_mutex);
        g_device = device;
    }

    // Print device info
    std::cerr << "[SDR] Driver: " << device->getDriverKey() << std::endl;
    std::cerr << "[SDR] Hardware: " << device->getHardwareKey() << std::endl;

    // List available antennas
    auto antennas = device->listAntennas(SOAPY_SDR_RX, 0);
    std::cerr << "[SDR] Available antennas: ";
    for (auto& a : antennas) std::cerr << a << " ";
    std::cerr << std::endl;

    // List available gains
    auto gains = device->listGains(SOAPY_SDR_RX, 0);
    std::cerr << "[SDR] Available gains: ";
    for (auto& g : gains) std::cerr << g << " ";
    std::cerr << std::endl;

    // ========================================================================
    // Configure device
    // ========================================================================

    std::cerr << "[SDR] Configuring device..." << std::endl;

    // Set sample rate
    device->setSampleRate(SOAPY_SDR_RX, 0, rate);
    double actual_rate = device->getSampleRate(SOAPY_SDR_RX, 0);
    std::cerr << "[SDR] Sample rate: " << actual_rate/1e6 << " MHz" << std::endl;
    current_sample_rate.store(actual_rate);

    // Set frequency
    device->setFrequency(SOAPY_SDR_RX, 0, freq);
    double actual_freq = device->getFrequency(SOAPY_SDR_RX, 0);
    std::cerr << "[SDR] Frequency: " << actual_freq/1e6 << " MHz" << std::endl;
    current_frequency.store(actual_freq);

    // Set gain
    device->setGain(SOAPY_SDR_RX, 0, gain);
    double actual_gain = device->getGain(SOAPY_SDR_RX, 0);
    std::cerr << "[SDR] Gain: " << actual_gain << " dB" << std::endl;
    current_gain.store(actual_gain);

    // Set bandwidth if supported
    try {
        device->setBandwidth(SOAPY_SDR_RX, 0, bw);
        double actual_bw = device->getBandwidth(SOAPY_SDR_RX, 0);
        std::cerr << "[SDR] Bandwidth: " << actual_bw/1e6 << " MHz" << std::endl;
    } catch (...) {
        std::cerr << "[SDR] Bandwidth setting not supported, using default" << std::endl;
    }

    // Set antenna if specified
    if (!ant.empty()) {
        device->setAntenna(SOAPY_SDR_RX, 0, ant);
    }
    std::cerr << "[SDR] Antenna: " << device->getAntenna(SOAPY_SDR_RX, 0) << std::endl;

    // Configure additional channels if needed
    for (size_t ch = 1; ch < num_channels; ++ch) {
        device->setSampleRate(SOAPY_SDR_RX, ch, rate);
        device->setFrequency(SOAPY_SDR_RX, ch, freq);
        device->setGain(SOAPY_SDR_RX, ch, gain);
        std::cerr << "[SDR] Channel " << ch << " configured" << std::endl;
    }

    // ========================================================================
    // Setup streaming
    // ========================================================================

    std::cerr << "[SDR] Setting up stream..." << std::endl;

    std::vector<size_t> channels;
    for (size_t ch = 0; ch < num_channels; ++ch) {
        channels.push_back(ch);
    }

    SoapySDR::Stream* rx_stream = device->setupStream(SOAPY_SDR_RX, SOAPY_SDR_CF32, channels);
    if (rx_stream == nullptr) {
        std::cerr << "Error: Failed to setup RX stream!" << std::endl;
        SoapySDR::Device::unmake(device);
        return EXIT_FAILURE;
    }

    // Get stream MTU
    size_t mtu = device->getStreamMTU(rx_stream);
    std::cerr << "[SDR] Stream MTU: " << mtu << " samples" << std::endl;

    // Start control socket thread
    std::thread control_thread(control_socket_thread);

    // Activate stream
    int ret = device->activateStream(rx_stream);
    if (ret != 0) {
        std::cerr << "Error: Failed to activate stream: " << SoapySDR::errToStr(ret) << std::endl;
        device->closeStream(rx_stream);
        SoapySDR::Device::unmake(device);
        return EXIT_FAILURE;
    }

    // ========================================================================
    // Allocate buffers and FFTW plans
    // ========================================================================

    // Sample buffers for all channels
    std::array<std::vector<std::complex<float>>, sdr::MAX_CHANNELS> buffers;
    std::vector<void*> buffs;
    for (size_t ch = 0; ch < num_channels; ++ch) {
        buffers[ch].resize(fft_size);
        buffs.push_back(buffers[ch].data());
    }

    // FFTW setup - one FFT plan per channel
    std::array<fftwf_complex*, sdr::MAX_CHANNELS> fft_in{}, fft_out{};
    std::array<fftwf_plan, sdr::MAX_CHANNELS> plans{};
    for (size_t ch = 0; ch < num_channels; ++ch) {
        fft_in[ch] = fftwf_alloc_complex(fft_size);
        fft_out[ch] = fftwf_alloc_complex(fft_size);
        plans[ch] = fftwf_plan_dft_1d(fft_size, fft_in[ch], fft_out[ch], FFTW_FORWARD, FFTW_MEASURE);
    }

    // Hann window
    std::vector<float> window(fft_size);
    for (size_t i = 0; i < fft_size; i++) {
        window[i] = 0.5f * (1.0f - std::cos(2.0f * M_PI * i / (fft_size - 1)));
    }

    // Signal handler
    std::signal(SIGINT, &sig_int_handler);
    std::signal(SIGTERM, &sig_int_handler);

    // Create shared memory producer if enabled
    std::unique_ptr<sdr::SharedFFTProducer> shm_producer;
    if (shm_mode) {
        try {
            shm_producer = std::make_unique<sdr::SharedFFTProducer>(
                sdr::DEFAULT_RING_SIZE, fft_size, num_channels);
            shm_producer->set_sample_rate(rate);
        } catch (const std::exception& e) {
            std::cerr << "[SDR] Failed to create shared memory: " << e.what() << std::endl;
            std::cerr << "[SDR] Falling back to stdout output" << std::endl;
            shm_mode = false;
        }
    }

    uint32_t frame_count = 0;
    auto last_status_time = std::chrono::steady_clock::now();
    auto start_time = std::chrono::steady_clock::now();

    // Power spectrum arrays
    std::array<std::vector<float>, sdr::MAX_CHANNELS> power_db;
    for (size_t ch = 0; ch < num_channels; ++ch) {
        power_db[ch].resize(fft_size);
    }

    std::cerr << "[SDR] Streaming started (" << num_channels << " channel(s))..." << std::endl;

    // ========================================================================
    // Main streaming loop
    // ========================================================================

    while (!stop_signal_called) {
        int flags = 0;
        long long time_ns = 0;

        // Receive samples
        int num_rx = device->readStream(rx_stream, buffs.data(), fft_size, flags, time_ns, 100000);

        if (num_rx < 0) {
            if (num_rx == SOAPY_SDR_TIMEOUT) {
                continue;
            }
            std::cerr << "Error: readStream failed: " << SoapySDR::errToStr(num_rx) << std::endl;
            continue;
        }

        if (static_cast<size_t>(num_rx) < fft_size) {
            // Not enough samples, skip this iteration
            continue;
        }

        // Get timestamp
        auto now = std::chrono::steady_clock::now();
        double timestamp = std::chrono::duration<double>(now - start_time).count();

        // Process each channel
        std::array<int16_t, sdr::MAX_CHANNELS> peak_bins{};
        std::array<float, sdr::MAX_CHANNELS> peak_powers{};
        std::array<const float*, sdr::MAX_CHANNELS> spectrum_ptrs{};

        for (size_t ch = 0; ch < num_channels; ++ch) {
            // Apply window and copy to FFT input
            for (size_t i = 0; i < fft_size; i++) {
                fft_in[ch][i][0] = buffers[ch][i].real() * window[i];
                fft_in[ch][i][1] = buffers[ch][i].imag() * window[i];
            }

            // Compute FFT
            fftwf_execute(plans[ch]);

            // Compute power spectrum (dBFS) and find peak
            float peak_power = -200.0f;
            int16_t peak_bin = 0;

            for (size_t i = 0; i < fft_size; i++) {
                // FFT shift
                size_t j = (i + fft_size/2) % fft_size;
                float real = fft_out[ch][j][0];
                float imag = fft_out[ch][j][1];
                float power = (real*real + imag*imag) / (fft_size * fft_size);
                power_db[ch][i] = 10.0f * std::log10(power + 1e-20f);

                if (power_db[ch][i] > peak_power) {
                    peak_power = power_db[ch][i];
                    peak_bin = static_cast<int16_t>(i);
                }
            }

            peak_bins[ch] = peak_bin;
            peak_powers[ch] = peak_power;
            spectrum_ptrs[ch] = power_db[ch].data();
        }

        // Get current parameters
        double curr_freq = current_frequency.load();
        double curr_rate = current_sample_rate.load();

        // Output FFT data
        if (shm_mode && shm_producer) {
            shm_producer->publish_multi(frame_count, timestamp,
                                       curr_freq, spectrum_ptrs.data(), num_channels,
                                       fft_size, peak_bins.data(), peak_powers.data(),
                                       false);
        } else if (binary_mode) {
            output_binary_fft(frame_count, timestamp,
                             curr_freq, curr_rate, fft_size,
                             peak_bins[0], peak_powers[0], power_db[0], false);
        } else {
            output_json_fft(timestamp, curr_freq, curr_rate,
                           fft_size, peak_powers[0], peak_bins[0], power_db[0]);
        }

        frame_count++;

        // Periodic status update (every 10 seconds)
        if (std::chrono::duration_cast<std::chrono::seconds>(now - last_status_time).count() >= 10) {
            if (!shm_mode) {
                if (binary_mode) {
                    output_binary_status(frame_count, 0.0f, 0.0f);
                } else {
                    output_json_status(frame_count, 0.0f, 0.0f);
                }
            }
            last_status_time = now;
        }
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    std::cerr << "[SDR] Stopping stream..." << std::endl;

    device->deactivateStream(rx_stream);
    device->closeStream(rx_stream);

    // Clear global device reference
    {
        std::lock_guard<std::mutex> lock(g_device_mutex);
        g_device = nullptr;
    }

    // Cleanup FFTW
    for (size_t ch = 0; ch < num_channels; ++ch) {
        fftwf_destroy_plan(plans[ch]);
        fftwf_free(fft_in[ch]);
        fftwf_free(fft_out[ch]);
    }

    // Cleanup shared memory
    shm_producer.reset();

    // Wait for control thread
    stop_signal_called = true;
    control_thread.join();

    // Cleanup device
    SoapySDR::Device::unmake(device);

    std::cerr << "[SDR] Streaming stopped cleanly" << std::endl;
    return EXIT_SUCCESS;
}
