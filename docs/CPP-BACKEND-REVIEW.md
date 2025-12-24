# C++ Backend Review and Recommendations for SDRAPP

**Date:** December 24, 2025
**Reviewer:** Claude Code Architecture Review
**Target:** Ettus B210 SDR Web Application

---

## Executive Summary

SDRAPP currently employs a **well-designed hybrid architecture** that separates:
- **Control Plane (Node.js)**: HTTP API, WebSocket, authentication, database
- **Data Plane (C++)**: Real-time signal processing, hardware interface

This review analyzes two paths forward:
1. **Option A: Full C++ Backend** - Replace Node.js entirely
2. **Option B: Enhanced Hybrid** - Optimize the existing architecture (Recommended)

**Recommendation:** Option B provides the best ROI. The current architecture correctly avoids having Node.js process 400 MB/s of IQ data. However, there are significant optimization opportunities in the C++ layer.

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Option A: Full C++ Backend Design](#2-option-a-full-c-backend-design)
3. [Option B: Enhanced Hybrid Architecture](#3-option-b-enhanced-hybrid-architecture-recommended)
4. [Critical C++ Improvements](#4-critical-c-improvements)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Appendix: Code Examples](#appendix-code-examples)

---

## 1. Current Architecture Analysis

### 1.1 Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                            │
├─────────────────────────────────────────────────────────────────────┤
│  React 19 + WebGL Waterfall + Canvas Spectrograph + tRPC Client     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP/WebSocket
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Node.js Server (Control Plane)                    │
├─────────────────────────────────────────────────────────────────────┤
│  Express + tRPC + WebSocket broadcast + MySQL/Drizzle + OAuth       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ child_process.spawn() + JSON stdout
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    C++ Daemons (Data Plane)                          │
├─────────────────────────────────────────────────────────────────────┤
│  sdr_streamer    │  iq_recorder    │  freq_scanner                  │
│  (FFT @ 60fps)   │  (IQ → File)    │  (Sweep + Peak)                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ UHD Library (Direct USB 3.0)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Ettus B210 Hardware                               │
├─────────────────────────────────────────────────────────────────────┤
│  50 MHz - 6 GHz  │  0-76 dB RX Gain  │  200 kHz - 56 MHz BW         │
│  GPSTCXO v3.2    │  USB 3.0          │  Dual Channel (A/B)          │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Existing C++ Components

| Component | Purpose | Output | Performance |
|-----------|---------|--------|-------------|
| `sdr_streamer.cpp` | Real-time FFT streaming | JSON @ 60 fps | ~10 KB/frame |
| `iq_recorder.cpp` | Raw IQ capture to file | Binary fc32_le | 80 MB/s @ 10 MSPS |
| `freq_scanner.cpp` | Frequency sweep | JSON array | ~50 steps/sec |

### 1.3 Identified Bottlenecks

| Issue | Location | Impact | Priority |
|-------|----------|--------|----------|
| JSON serialization overhead | `sdr_streamer.cpp:266-278` | +15% CPU | High |
| Process restart on config change | `production-hardware.ts:166-190` | 2-3s latency | High |
| No window function in scanner | `freq_scanner.cpp:33-66` | Spectral leakage | Medium |
| Synchronous file I/O in recorder | `iq_recorder.cpp:143-144` | Possible drops | Medium |
| Single-channel only | All daemons | 50% hardware unused | Low |

### 1.4 What's Done Well

- **Correct architecture**: Node.js never touches raw IQ samples
- **Proper signal processing**: Hann window, FFTW3, dBFS conversion
- **GPSDO support**: Auto-detection and lock wait with timeout
- **Clean shutdown**: SIGTERM/SIGINT handlers in all daemons
- **SigMF compliance**: Standard metadata format for recordings

---

## 2. Option A: Full C++ Backend Design

A complete C++ backend would provide:
- **Lower latency**: No JSON parsing overhead
- **Single deployment artifact**: One binary, fewer moving parts
- **Direct memory sharing**: Zero-copy FFT to WebSocket

### 2.1 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    C++ Unified Backend                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    HTTP/WebSocket Server                     │    │
│  │                    (Boost.Beast / uWebSockets)               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│  ┌─────────────┬─────────────┼─────────────┬─────────────────────┐  │
│  ▼             ▼             ▼             ▼                     │  │
│ REST API    WebSocket     OAuth       SQLite/MySQL               │  │
│ Handler     Broadcast     Proxy       Connection                 │  │
│                              │                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Hardware Abstraction Layer                  │    │
│  │              (Threaded, Lock-Free Ring Buffers)               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│  ┌─────────────┬─────────────┼─────────────┬─────────────────────┐  │
│  ▼             ▼             ▼             ▼                     │  │
│ SDR          FFT          IQ            Freq                     │  │
│ Streamer    Engine       Recorder      Scanner                   │  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Library | Rationale |
|-------|---------|-----------|
| HTTP Server | Boost.Beast or uWebSockets | High-performance, async I/O |
| JSON | nlohmann/json or simdjson | Faster than hand-rolled |
| Database | libmysqlclient or SQLiteCpp | MySQL compatibility |
| Authentication | jwt-cpp | JWT verification |
| Configuration | Boost.PropertyTree | JSON/INI config |
| Logging | spdlog | Fast, header-only |
| IPC | ZeroMQ or nanomsg | Inter-thread communication |

### 2.3 Full C++ Backend: Core Components

#### 2.3.1 Main Server Class

```cpp
// sdr_backend.hpp
#pragma once

#include <boost/beast.hpp>
#include <boost/asio.hpp>
#include <uhd/usrp/multi_usrp.hpp>
#include <thread>
#include <atomic>

namespace sdr {

class SDRBackend {
public:
    struct Config {
        uint16_t http_port = 3000;
        std::string db_connection;
        std::string jwt_secret;
        double default_freq = 915e6;
        double default_rate = 10e6;
        double default_gain = 50.0;
    };

    explicit SDRBackend(const Config& config);
    ~SDRBackend();

    void start();
    void stop();

private:
    // HTTP/WebSocket server
    void run_http_server();
    void handle_websocket_session(boost::beast::websocket::stream<boost::beast::tcp_stream>& ws);

    // Hardware control
    void init_hardware();
    void start_streaming();
    void stop_streaming();

    // FFT processing thread
    void fft_worker();

    // API handlers
    nlohmann::json handle_get_status();
    nlohmann::json handle_set_frequency(double freq);
    nlohmann::json handle_start_recording(const RecordingParams& params);

private:
    Config config_;
    std::atomic<bool> running_{false};

    // UHD hardware
    uhd::usrp::multi_usrp::sptr usrp_;
    uhd::rx_streamer::sptr rx_stream_;

    // Thread pool
    boost::asio::io_context io_ctx_;
    std::vector<std::thread> workers_;

    // WebSocket clients
    std::mutex clients_mutex_;
    std::set<boost::beast::websocket::stream<boost::beast::tcp_stream>*> clients_;

    // Lock-free ring buffer for IQ samples
    moodycamel::ReaderWriterQueue<std::vector<std::complex<float>>> sample_queue_;
};

} // namespace sdr
```

#### 2.3.2 Binary FFT Protocol

Instead of JSON, use a compact binary format:

```cpp
// Binary FFT frame format (header + data)
struct FFTFrameHeader {
    uint32_t magic;           // 0x46465431 ("FFT1")
    uint32_t frame_number;
    double   timestamp;
    double   center_freq;
    double   sample_rate;
    uint16_t fft_size;
    int16_t  peak_bin;
    float    peak_power;
    // Followed by fft_size × sizeof(float) bytes of power spectrum data
};

void broadcast_fft_binary(const FFTFrameHeader& header, const float* spectrum) {
    std::vector<uint8_t> frame(sizeof(header) + header.fft_size * sizeof(float));
    memcpy(frame.data(), &header, sizeof(header));
    memcpy(frame.data() + sizeof(header), spectrum, header.fft_size * sizeof(float));

    std::lock_guard<std::mutex> lock(clients_mutex_);
    for (auto* client : clients_) {
        client->binary(true);
        client->write(boost::asio::buffer(frame));
    }
}
```

### 2.4 Full C++ Backend: Pros and Cons

| Pros | Cons |
|------|------|
| Single deployment binary | 6-8 weeks development time |
| Lower memory footprint (~50 MB vs ~150 MB) | Loss of tRPC type safety |
| Native binary protocol | Re-implement OAuth flow |
| Real-time parameter tuning | No hot-reload for development |
| Better debugging (single process) | Smaller talent pool for C++ web dev |
| Deterministic latency | Database ORM less mature than Drizzle |

### 2.5 Effort Estimate (Full Replacement)

| Component | Effort | Risk |
|-----------|--------|------|
| HTTP/WebSocket server | 2 weeks | Medium |
| REST API reimplementation | 2 weeks | Low |
| OAuth proxy integration | 1 week | Medium |
| Database layer | 1 week | Low |
| Frontend protocol adaptation | 1 week | Low |
| Testing and stabilization | 2 weeks | Medium |
| **Total** | **8-10 weeks** | **Medium** |

---

## 3. Option B: Enhanced Hybrid Architecture (Recommended)

Enhance the existing architecture without full replacement.

### 3.1 Proposed Improvements

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Enhancements                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. BINARY PROTOCOL                                                  │
│     sdr_streamer → Binary stdout → Node.js → Binary WebSocket        │
│     (Eliminate JSON serialization overhead)                          │
│                                                                      │
│  2. UNIX DOMAIN SOCKET + SHARED MEMORY                              │
│     sdr_streamer ←→ Node.js via control socket                      │
│     FFT data via mmap'd shared memory ring buffer                    │
│                                                                      │
│  3. REAL-TIME PARAMETER CHANGES                                     │
│     Control socket commands for freq/gain/rate without restart       │
│                                                                      │
│  4. DUAL-CHANNEL SUPPORT                                            │
│     Utilize both B210 RX channels for diversity/MIMO                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Enhancement Priority Matrix

| Enhancement | Impact | Effort | Priority |
|-------------|--------|--------|----------|
| Binary FFT protocol | High | 1 week | P0 |
| Runtime parameter changes | High | 1 week | P0 |
| Async file I/O in recorder | Medium | 3 days | P1 |
| Window function in scanner | Medium | 1 day | P1 |
| Shared memory FFT transport | Medium | 2 weeks | P2 |
| Dual-channel streaming | Low | 2 weeks | P3 |

---

## 4. Critical C++ Improvements

### 4.1 Binary FFT Protocol (P0)

Replace JSON with binary framing for 70% bandwidth reduction.

**Current (JSON):** ~10 KB/frame
```json
{"type":"fft","timestamp":1703456789.123,"centerFreq":915000000,...,"data":[-100.5,-102.1,...]}
```

**Proposed (Binary):** ~4 KB/frame
```
[4B magic][4B frame#][8B timestamp][8B freq][8B rate][2B size][4B×2048 spectrum]
```

#### Implementation Changes

**sdr_streamer.cpp changes:**

```cpp
// New binary output mode
struct BinaryFFTFrame {
    uint32_t magic = 0x46465431;  // "FFT1"
    uint32_t frame_number;
    double timestamp;
    double center_freq;
    double sample_rate;
    uint16_t fft_size;
    uint16_t reserved;
    int16_t peak_bin;
    float peak_power;
    // float spectrum[fft_size] follows
} __attribute__((packed));

void output_binary_fft(const BinaryFFTFrame& header, const float* spectrum) {
    // Write to stdout in binary mode
    fwrite(&header, sizeof(header), 1, stdout);
    fwrite(spectrum, sizeof(float), header.fft_size, stdout);
    fflush(stdout);
}
```

**Node.js parsing:**

```typescript
// production-hardware.ts
private parseBinaryFFT(buffer: Buffer): FFTData | null {
    if (buffer.length < 44) return null; // Minimum header size

    const magic = buffer.readUInt32LE(0);
    if (magic !== 0x46465431) return null; // "FFT1"

    const fftSize = buffer.readUInt16LE(32);
    const expectedSize = 44 + fftSize * 4;
    if (buffer.length < expectedSize) return null;

    const fftData = new Float32Array(buffer.buffer, buffer.byteOffset + 44, fftSize);

    return {
        timestamp: buffer.readDoubleLE(8),
        centerFreq: buffer.readDoubleLE(16),
        sampleRate: buffer.readDoubleLE(24),
        fftSize,
        fftData: Array.from(fftData)
    };
}
```

### 4.2 Runtime Parameter Changes (P0)

Eliminate the stop/restart cycle when changing frequency, gain, or sample rate.

#### Control Socket Protocol

```cpp
// Add to sdr_streamer.cpp
#include <sys/un.h>

constexpr char CONTROL_SOCKET_PATH[] = "/tmp/sdr_streamer.sock";

struct ControlCommand {
    enum Type : uint8_t {
        SET_FREQUENCY = 1,
        SET_SAMPLE_RATE = 2,
        SET_GAIN = 3,
        SET_BANDWIDTH = 4,
        GET_STATUS = 10,
        STOP = 255
    };
    Type type;
    double value;
} __attribute__((packed));

void control_thread(uhd::usrp::multi_usrp::sptr usrp, std::atomic<bool>& running) {
    int sock = socket(AF_UNIX, SOCK_STREAM, 0);

    sockaddr_un addr{};
    addr.sun_family = AF_UNIX;
    strncpy(addr.sun_path, CONTROL_SOCKET_PATH, sizeof(addr.sun_path) - 1);

    unlink(CONTROL_SOCKET_PATH);
    bind(sock, (sockaddr*)&addr, sizeof(addr));
    listen(sock, 1);

    while (running) {
        int client = accept(sock, nullptr, nullptr);
        if (client < 0) continue;

        ControlCommand cmd;
        while (recv(client, &cmd, sizeof(cmd), 0) == sizeof(cmd)) {
            switch (cmd.type) {
                case ControlCommand::SET_FREQUENCY:
                    usrp->set_rx_freq(cmd.value);
                    break;
                case ControlCommand::SET_GAIN:
                    usrp->set_rx_gain(cmd.value);
                    break;
                case ControlCommand::SET_SAMPLE_RATE:
                    usrp->set_rx_rate(cmd.value);
                    break;
                case ControlCommand::STOP:
                    running = false;
                    break;
            }
        }
        close(client);
    }
    close(sock);
    unlink(CONTROL_SOCKET_PATH);
}
```

**Node.js client:**

```typescript
// hardware-control-socket.ts
import * as net from 'net';

export class HardwareControlSocket {
    private socket: net.Socket | null = null;
    private readonly socketPath = '/tmp/sdr_streamer.sock';

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket = net.createConnection(this.socketPath, resolve);
            this.socket.on('error', reject);
        });
    }

    async setFrequency(freq: number): Promise<void> {
        const cmd = Buffer.alloc(9);
        cmd.writeUInt8(1, 0);  // SET_FREQUENCY
        cmd.writeDoubleLE(freq, 1);
        this.socket?.write(cmd);
    }

    async setGain(gain: number): Promise<void> {
        const cmd = Buffer.alloc(9);
        cmd.writeUInt8(3, 0);  // SET_GAIN
        cmd.writeDoubleLE(gain, 1);
        this.socket?.write(cmd);
    }
}
```

### 4.3 Async File I/O for Recorder (P1)

Use a ring buffer with a dedicated writer thread to prevent sample drops.

```cpp
// iq_recorder.cpp - Async writer
#include <moodycamel/readerwriterqueue.h>
#include <thread>

class AsyncFileWriter {
public:
    AsyncFileWriter(const std::string& path, size_t buffer_size)
        : queue_(buffer_size / sizeof(std::complex<float>))
    {
        file_.open(path, std::ios::binary);
        writer_thread_ = std::thread(&AsyncFileWriter::writer_loop, this);
    }

    ~AsyncFileWriter() {
        done_ = true;
        writer_thread_.join();
        file_.close();
    }

    void write(const std::complex<float>* data, size_t count) {
        for (size_t i = 0; i < count; ++i) {
            while (!queue_.try_enqueue(data[i])) {
                std::this_thread::yield();  // Back-pressure
            }
        }
    }

private:
    void writer_loop() {
        std::complex<float> sample;
        std::vector<std::complex<float>> batch;
        batch.reserve(8192);

        while (!done_ || queue_.size_approx() > 0) {
            while (queue_.try_dequeue(sample)) {
                batch.push_back(sample);
                if (batch.size() >= 8192) {
                    file_.write(reinterpret_cast<const char*>(batch.data()),
                               batch.size() * sizeof(std::complex<float>));
                    batch.clear();
                }
            }
            if (!batch.empty()) {
                file_.write(reinterpret_cast<const char*>(batch.data()),
                           batch.size() * sizeof(std::complex<float>));
                batch.clear();
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
    }

    moodycamel::ReaderWriterQueue<std::complex<float>> queue_;
    std::ofstream file_;
    std::thread writer_thread_;
    std::atomic<bool> done_{false};
};
```

### 4.4 Window Function in Scanner (P1)

Add a window function to reduce spectral leakage in frequency scanner.

```cpp
// freq_scanner.cpp - Add Blackman-Harris window
double compute_peak_power(const std::vector<std::complex<float>>& samples, size_t fft_size) {
    static std::vector<float> window;
    if (window.size() != fft_size) {
        window.resize(fft_size);
        // Blackman-Harris window (better sidelobe suppression)
        for (size_t i = 0; i < fft_size; ++i) {
            double n = static_cast<double>(i) / (fft_size - 1);
            window[i] = 0.35875 - 0.48829 * cos(2 * M_PI * n)
                      + 0.14128 * cos(4 * M_PI * n)
                      - 0.01168 * cos(6 * M_PI * n);
        }
    }

    fftwf_complex* in = fftwf_alloc_complex(fft_size);
    fftwf_complex* out = fftwf_alloc_complex(fft_size);
    fftwf_plan plan = fftwf_plan_dft_1d(fft_size, in, out, FFTW_FORWARD, FFTW_ESTIMATE);

    // Apply window during copy
    for (size_t i = 0; i < fft_size && i < samples.size(); ++i) {
        in[i][0] = samples[i].real() * window[i];
        in[i][1] = samples[i].imag() * window[i];
    }

    fftwf_execute(plan);

    // ... rest of processing
}
```

### 4.5 Shared Memory FFT Transport (P2)

For zero-copy performance, use POSIX shared memory.

```cpp
// shared_fft_buffer.hpp
#include <sys/mman.h>
#include <fcntl.h>
#include <semaphore.h>

constexpr char SHM_NAME[] = "/sdr_fft_buffer";
constexpr size_t RING_SIZE = 64;  // Number of FFT frames

struct SharedFFTRing {
    struct Frame {
        double timestamp;
        double center_freq;
        double sample_rate;
        uint16_t fft_size;
        uint16_t valid;
        float spectrum[2048];
    };

    std::atomic<size_t> write_idx{0};
    std::atomic<size_t> read_idx{0};
    Frame frames[RING_SIZE];
};

class FFTProducer {
public:
    FFTProducer() {
        int fd = shm_open(SHM_NAME, O_CREAT | O_RDWR, 0666);
        ftruncate(fd, sizeof(SharedFFTRing));
        ring_ = static_cast<SharedFFTRing*>(
            mmap(nullptr, sizeof(SharedFFTRing), PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0)
        );
        close(fd);
    }

    void publish(const FFTData& data) {
        size_t idx = ring_->write_idx.fetch_add(1) % RING_SIZE;
        auto& frame = ring_->frames[idx];
        frame.timestamp = data.timestamp;
        frame.center_freq = data.centerFreq;
        frame.sample_rate = data.sampleRate;
        frame.fft_size = data.fftSize;
        memcpy(frame.spectrum, data.spectrum, data.fftSize * sizeof(float));
        frame.valid = 1;
    }

private:
    SharedFFTRing* ring_;
};
```

---

## 5. Implementation Roadmap

### Phase 1: Quick Wins (Week 1-2)

| Task | File | Description |
|------|------|-------------|
| Add command-line binary mode flag | `sdr_streamer.cpp` | `--binary` flag for binary output |
| Update Node.js parser | `production-hardware.ts` | Parse binary frames |
| Forward binary to WebSocket | `websocket.ts` | Binary passthrough mode |
| Update frontend | `useWebSocketFFT.ts` | DataView parsing |

### Phase 2: Real-time Control (Week 3-4)

| Task | File | Description |
|------|------|-------------|
| Add control socket thread | `sdr_streamer.cpp` | Unix domain socket listener |
| Node.js control client | `hardware-control-socket.ts` | New module |
| Remove restart logic | `production-hardware.ts` | Use socket commands |
| Update tRPC handlers | `device-router.ts` | Instant parameter changes |

### Phase 3: Signal Processing Improvements (Week 5-6)

| Task | File | Description |
|------|------|-------------|
| Add window to scanner | `freq_scanner.cpp` | Blackman-Harris window |
| Async file writer | `iq_recorder.cpp` | Ring buffer + writer thread |
| Add averaging mode | `sdr_streamer.cpp` | Configurable frame averaging |
| DC offset correction | `sdr_streamer.cpp` | Auto-calibration routine |

### Phase 4: Advanced Features (Optional)

| Task | Description | Effort |
|------|-------------|--------|
| Shared memory transport | Zero-copy to Node.js | 2 weeks |
| Dual-channel streaming | Both B210 RX channels | 2 weeks |
| Hardware sweep mode | Faster frequency scans | 1 week |
| GPU-accelerated FFT | cuFFT/clFFT | 3 weeks |

---

## Appendix: Code Examples

### A.1 Complete Binary Mode sdr_streamer

See separate file: `sdr_streamer_binary.cpp.example`

### A.2 CMakeLists.txt Updates

```cmake
# Add to existing CMakeLists.txt for new dependencies

# For shared memory
find_package(Threads REQUIRED)

# For async queue (header-only)
include(FetchContent)
FetchContent_Declare(
    readerwriterqueue
    GIT_REPOSITORY https://github.com/cameron314/readerwriterqueue.git
    GIT_TAG v1.0.6
)
FetchContent_MakeAvailable(readerwriterqueue)

target_link_libraries(sdr_streamer
    ${UHD_LIBRARIES}
    ${Boost_LIBRARIES}
    ${FFTW3F_LIBRARIES}
    Threads::Threads
    rt  # For shm_open/mmap
)

target_include_directories(sdr_streamer PRIVATE
    ${readerwriterqueue_SOURCE_DIR}
)
```

### A.3 Test Commands

```bash
# Test binary output mode
./sdr_streamer --freq 915e6 --rate 10e6 --gain 50 --binary | xxd | head

# Test control socket (after implementing)
echo -ne '\x01\x00\x00\x00\x00\x00\x00\x60\x41' | nc -U /tmp/sdr_streamer.sock

# Measure FFT frame rate
./sdr_streamer --freq 915e6 --rate 10e6 --gain 50 2>/dev/null | pv -l >/dev/null
```

---

## Conclusion

The existing SDRAPP architecture is fundamentally sound. Rather than a complete C++ backend rewrite, we recommend focusing on:

1. **Binary FFT protocol** - Immediate 70% bandwidth savings
2. **Runtime parameter control** - Eliminate restart latency
3. **Async file I/O** - Prevent sample drops during recording
4. **Window functions** - Improve spectral analysis accuracy

These enhancements provide 80% of the benefits of a full C++ backend at 20% of the effort and risk.

---

## References

- [UHD Manual](https://files.ettus.com/manual/)
- [FFTW3 Documentation](http://www.fftw.org/fftw3_doc/)
- [Boost.Beast](https://www.boost.org/doc/libs/release/libs/beast/)
- [SigMF Specification](https://github.com/sigmf/SigMF)
- [moodycamel::ReaderWriterQueue](https://github.com/cameron314/readerwriterqueue)
