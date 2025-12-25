/**
 * sdr_streamer.cpp - Ettus B210 USRP SDR Streaming Daemon
 *
 * Hardware: B210 (serial 194919) with GPSTCXO v3.2 GPSDO
 * Connection: USB 3.0
 * RX: 50-6000 MHz, 0-76 dB gain, 200 kHz - 56 MHz BW
 * TX: 50-6000 MHz, 0-89.8 dB gain
 *
 * Features:
 * - Binary FFT output mode (--binary) for 70% bandwidth reduction
 * - Shared memory output mode (--shm) for zero-copy IPC
 * - Dual-channel mode (--channels 2) for MIMO/diversity reception
 * - Runtime parameter control via Unix domain socket (no restart required)
 * - JSON FFT output mode for backward compatibility
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
static std::atomic<bool> gps_locked{false};

void sig_int_handler(int) {
    stop_signal_called = true;
}

// ============================================================================
// B210 hardware limits (from uhd_usrp_probe)
// ============================================================================

constexpr double B210_MIN_FREQ = 50e6;      // 50 MHz
constexpr double B210_MAX_FREQ = 6000e6;    // 6000 MHz
constexpr double B210_MIN_RX_GAIN = 0.0;    // 0 dB
constexpr double B210_MAX_RX_GAIN = 76.0;   // 76 dB
constexpr double B210_MIN_TX_GAIN = 0.0;    // 0 dB
constexpr double B210_MAX_TX_GAIN = 89.8;   // 89.8 dB
constexpr double B210_MIN_BW = 200e3;       // 200 kHz
constexpr double B210_MAX_BW = 56e6;        // 56 MHz

// ============================================================================
// Binary protocol structures (packed for wire format)
// ============================================================================

#pragma pack(push, 1)

// Binary FFT frame header
// Note: Size varies by platform due to packing (42 bytes on ARM64, 44 on x86_64)
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
    // Followed by fft_size * sizeof(float) bytes of spectrum data
};
// Platform-portable size check: verify struct is within expected range
static_assert(sizeof(BinaryFFTHeader) >= 42 && sizeof(BinaryFFTHeader) <= 48,
              "BinaryFFTHeader size unexpected - check struct packing");

// Binary status frame
// Note: Size varies by platform due to packing (56-60 bytes depending on alignment)
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
// Platform-portable size check
static_assert(sizeof(BinaryStatusFrame) >= 56 && sizeof(BinaryStatusFrame) <= 64,
              "BinaryStatusFrame size unexpected - check struct packing");

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
// GPSDO status
// ============================================================================

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
        status.servo = 0.0;
    }
    return status;
}

// ============================================================================
// Control socket server thread
// ============================================================================

constexpr char CONTROL_SOCKET_PATH[] = "/tmp/sdr_streamer.sock";

void control_socket_thread(uhd::usrp::multi_usrp::sptr usrp) {
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
                switch (cmd.type) {
                    case ControlCommand::SET_FREQUENCY:
                        if (cmd.value >= B210_MIN_FREQ && cmd.value <= B210_MAX_FREQ) {
                            usrp->set_rx_freq(cmd.value);
                            resp.actual_value = usrp->get_rx_freq();
                            current_frequency.store(resp.actual_value);
                            snprintf(resp.message, sizeof(resp.message),
                                    "Frequency set to %.6f MHz", resp.actual_value / 1e6);
                            std::cerr << "[Control] " << resp.message << std::endl;
                        } else {
                            resp.success = 0;
                            snprintf(resp.message, sizeof(resp.message),
                                    "Frequency out of range [%.0f-%.0f MHz]",
                                    B210_MIN_FREQ/1e6, B210_MAX_FREQ/1e6);
                        }
                        break;

                    case ControlCommand::SET_GAIN:
                        if (cmd.value >= B210_MIN_RX_GAIN && cmd.value <= B210_MAX_RX_GAIN) {
                            usrp->set_rx_gain(cmd.value);
                            resp.actual_value = usrp->get_rx_gain();
                            current_gain.store(resp.actual_value);
                            snprintf(resp.message, sizeof(resp.message),
                                    "Gain set to %.1f dB", resp.actual_value);
                            std::cerr << "[Control] " << resp.message << std::endl;
                        } else {
                            resp.success = 0;
                            snprintf(resp.message, sizeof(resp.message),
                                    "Gain out of range [%.0f-%.0f dB]",
                                    B210_MIN_RX_GAIN, B210_MAX_RX_GAIN);
                        }
                        break;

                    case ControlCommand::SET_BANDWIDTH:
                        if (cmd.value >= B210_MIN_BW && cmd.value <= B210_MAX_BW) {
                            usrp->set_rx_bandwidth(cmd.value);
                            resp.actual_value = usrp->get_rx_bandwidth();
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
                                "Freq=%.3fMHz Gain=%.1fdB GPS=%s",
                                current_frequency.load() / 1e6,
                                current_gain.load(),
                                gps_locked.load() ? "locked" : "unlocked");
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

void output_json_status(size_t frame_count, const GPSDOStatus& gps, float rx_temp, float tx_temp) {
    std::cout << "{\"type\":\"status\""
              << ",\"frames\":" << frame_count
              << ",\"gpsLocked\":" << (gps.locked ? "true" : "false")
              << ",\"gpsTime\":\"" << gps.time << "\""
              << ",\"gpsServo\":" << gps.servo
              << ",\"rxTemp\":" << rx_temp
              << ",\"txTemp\":" << tx_temp
              << "}" << std::endl;
}

void output_binary_status(uint32_t frame_count, const GPSDOStatus& gps, float rx_temp, float tx_temp) {
    BinaryStatusFrame status{};
    status.magic = 0x53545431;  // "STT1"
    status.frame_count = frame_count;
    status.rx_temp = rx_temp;
    status.tx_temp = tx_temp;
    status.gps_locked = gps.locked ? 1 : 0;
    status.pll_locked = 1;  // Assume locked if streaming
    status.reserved = 0;
    status.gps_servo = gps.servo;
    strncpy(status.gps_time, gps.time.c_str(), sizeof(status.gps_time) - 1);

    fwrite(&status, sizeof(status), 1, stdout);
    fflush(stdout);
}

// ============================================================================
// Main
// ============================================================================

int UHD_SAFE_MAIN(int argc, char *argv[]) {
    // Set thread priority
    uhd::set_thread_priority_safe();

    // Command line options
    std::string device_args, subdev, ant, ref, clock_source;
    double freq, rate, gain, bw;
    size_t fft_size, num_channels;
    bool use_gpsdo, binary_mode, shm_mode;

    po::options_description desc("Allowed options");
    desc.add_options()
        ("help", "help message")
        ("args", po::value<std::string>(&device_args)->default_value(""), "UHD device args")
        ("freq", po::value<double>(&freq)->default_value(915e6), "RF center frequency in Hz")
        ("rate", po::value<double>(&rate)->default_value(10e6), "Sample rate in Hz")
        ("gain", po::value<double>(&gain)->default_value(50), "RX gain in dB")
        ("bw", po::value<double>(&bw)->default_value(10e6), "Analog bandwidth in Hz")
        ("ant", po::value<std::string>(&ant)->default_value("RX2"), "Antenna selection")
        ("subdev", po::value<std::string>(&subdev)->default_value(""), "Subdevice specification (auto-selected if empty)")
        ("ref", po::value<std::string>(&ref)->default_value("internal"), "Reference source (internal/external/gpsdo)")
        ("clock", po::value<std::string>(&clock_source)->default_value("internal"), "Clock source")
        ("fft-size", po::value<size_t>(&fft_size)->default_value(2048), "FFT size")
        ("gpsdo", po::value<bool>(&use_gpsdo)->default_value(true), "Use GPSDO if available")
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
    if (num_channels < 1 || num_channels > sdr::MAX_CHANNELS) {
        std::cerr << "Error: Channel count " << num_channels << " out of range [1-"
                  << sdr::MAX_CHANNELS << "]" << std::endl;
        return EXIT_FAILURE;
    }

    // Auto-select subdev based on channel count
    if (subdev.empty()) {
        subdev = (num_channels == 2) ? "A:A A:B" : "A:A";
    }

    // Initialize atomic state
    current_frequency.store(freq);
    current_gain.store(gain);
    current_sample_rate.store(rate);

    if (binary_mode) {
        std::cerr << "[SDR] Binary output mode enabled" << std::endl;
    }
    if (shm_mode) {
        std::cerr << "[SDR] Shared memory output mode enabled" << std::endl;
    }
    if (num_channels > 1) {
        std::cerr << "[SDR] Dual-channel mode enabled (" << num_channels << " channels)" << std::endl;
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
                    gps_locked.store(true);
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

    // Configure RX for all channels
    usrp->set_rx_subdev_spec(subdev);
    usrp->set_rx_rate(rate);

    // Configure each channel
    for (size_t ch = 0; ch < num_channels; ++ch) {
        usrp->set_rx_freq(freq, ch);
        usrp->set_rx_gain(gain, ch);
        usrp->set_rx_bandwidth(bw, ch);
        usrp->set_rx_antenna(ant, ch);

        std::cerr << boost::format("Channel %zu configured: Freq=%.3f MHz, Gain=%.1f dB, BW=%.2f MHz")
                  % ch % (usrp->get_rx_freq(ch)/1e6) % usrp->get_rx_gain(ch)
                  % (usrp->get_rx_bandwidth(ch)/1e6) << std::endl;
    }

    std::this_thread::sleep_for(std::chrono::seconds(1)); // Allow hardware to settle

    // Update atomics with actual values (from channel 0)
    current_frequency.store(usrp->get_rx_freq(0));
    current_gain.store(usrp->get_rx_gain(0));
    current_sample_rate.store(usrp->get_rx_rate());

    // Print actual settings
    std::cerr << boost::format("Actual RX Rate: %f Msps") % (usrp->get_rx_rate()/1e6) << std::endl;
    std::cerr << boost::format("Actual RX Freq: %f MHz") % (usrp->get_rx_freq(0)/1e6) << std::endl;
    std::cerr << boost::format("Actual RX Gain: %f dB") % usrp->get_rx_gain(0) << std::endl;
    std::cerr << boost::format("Actual RX BW: %f MHz") % (usrp->get_rx_bandwidth(0)/1e6) << std::endl;

    // Start control socket thread
    std::thread control_thread(control_socket_thread, usrp);

    // Setup streaming with channel specification
    uhd::stream_args_t stream_args("fc32", "sc16");
    for (size_t ch = 0; ch < num_channels; ++ch) {
        stream_args.channels.push_back(ch);
    }
    uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);

    uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
    stream_cmd.stream_now = true;
    rx_stream->issue_stream_cmd(stream_cmd);

    // Allocate buffers for all channels
    std::array<std::vector<std::complex<float>>, sdr::MAX_CHANNELS> buffers;
    std::vector<std::complex<float>*> buffs;
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

    // Hann window (shared across channels)
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

    uhd::rx_metadata_t md;
    uint32_t frame_count = 0;
    auto last_status_time = std::chrono::steady_clock::now();

    // Power spectrum arrays - one per channel
    std::array<std::vector<float>, sdr::MAX_CHANNELS> power_db;
    for (size_t ch = 0; ch < num_channels; ++ch) {
        power_db[ch].resize(fft_size);
    }

    std::cerr << "[SDR] Streaming started (" << num_channels << " channel(s))..." << std::endl;

    while (!stop_signal_called) {
        // Receive samples (all channels at once)
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
                power_db[ch][i] = 10.0f * std::log10(power + 1e-20f);  // Avoid log(0)

                if (power_db[ch][i] > peak_power) {
                    peak_power = power_db[ch][i];
                    peak_bin = static_cast<int16_t>(i);
                }
            }

            peak_bins[ch] = peak_bin;
            peak_powers[ch] = peak_power;
            spectrum_ptrs[ch] = power_db[ch].data();
        }

        // Get current parameters (may have been changed via control socket)
        double curr_freq = current_frequency.load();
        double curr_rate = current_sample_rate.load();
        bool curr_gps = gps_locked.load();

        // Output FFT data via selected method
        if (shm_mode && shm_producer) {
            // Zero-copy shared memory output (supports multi-channel)
            shm_producer->publish_multi(frame_count, md.time_spec.get_real_secs(),
                                       curr_freq, spectrum_ptrs.data(), num_channels,
                                       fft_size, peak_bins.data(), peak_powers.data(),
                                       curr_gps);
        } else if (binary_mode) {
            // Binary stdout output (primary channel only for backward compat)
            output_binary_fft(frame_count, md.time_spec.get_real_secs(),
                             curr_freq, curr_rate, fft_size,
                             peak_bins[0], peak_powers[0], power_db[0], curr_gps);
        } else {
            // JSON stdout output (primary channel only for backward compat)
            output_json_fft(md.time_spec.get_real_secs(), curr_freq, curr_rate,
                           fft_size, peak_powers[0], peak_bins[0], power_db[0]);
        }

        frame_count++;

        // Periodic status update with GPSDO info (every 10 seconds)
        auto now = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::seconds>(now - last_status_time).count() >= 10) {
            GPSDOStatus gps = get_gpsdo_status(usrp);
            gps_locked.store(gps.locked);

            // Get temperature sensors
            float rx_temp = 0.0f, tx_temp = 0.0f;
            try {
                rx_temp = std::stof(usrp->get_rx_sensor("temp").value);
                tx_temp = std::stof(usrp->get_tx_sensor("temp").value);
            } catch (...) {}

            if (!shm_mode) {
                if (binary_mode) {
                    output_binary_status(frame_count, gps, rx_temp, tx_temp);
                } else {
                    output_json_status(frame_count, gps, rx_temp, tx_temp);
                }
            }

            last_status_time = now;
        }
    }

    // Cleanup
    stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
    rx_stream->issue_stream_cmd(stream_cmd);

    // Clean up FFTW resources for all channels
    for (size_t ch = 0; ch < num_channels; ++ch) {
        fftwf_destroy_plan(plans[ch]);
        fftwf_free(fft_in[ch]);
        fftwf_free(fft_out[ch]);
    }

    // Clean up shared memory producer
    shm_producer.reset();

    // Wait for control thread to finish
    control_thread.join();

    std::cerr << "Streaming stopped cleanly" << std::endl;
    return EXIT_SUCCESS;
}
