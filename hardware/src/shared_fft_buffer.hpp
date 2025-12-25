/**
 * shared_fft_buffer.hpp - Shared Memory FFT Ring Buffer
 *
 * Lock-free ring buffer for zero-copy FFT data transfer between
 * C++ (producer) and Node.js (consumer) using POSIX shared memory.
 *
 * Memory Layout:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ SharedFFTHeader (64 bytes)                                  │
 * │   - magic, version, ring_size, fft_size                     │
 * │   - write_idx, read_idx (atomic)                            │
 * │   - channel_count, sample_rate, etc.                        │
 * ├─────────────────────────────────────────────────────────────┤
 * │ FFTFrame[0] (variable size per frame)                       │
 * │   - timestamp, center_freq, flags, peak info                │
 * │   - spectrum data[fft_size]                                 │
 * ├─────────────────────────────────────────────────────────────┤
 * │ FFTFrame[1]                                                 │
 * ├─────────────────────────────────────────────────────────────┤
 * │ ... (ring_size frames total)                                │
 * └─────────────────────────────────────────────────────────────┘
 */

#pragma once

#include <cstdint>
#include <cstring>
#include <atomic>
#include <sys/mman.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <cerrno>
#include <stdexcept>
#include <string>

namespace sdr {

// Shared memory configuration
constexpr char SHM_NAME[] = "/sdr_fft_buffer";
constexpr uint32_t SHM_MAGIC = 0x53445246;  // "SDRF"
constexpr uint32_t SHM_VERSION = 1;
constexpr size_t DEFAULT_RING_SIZE = 64;     // Number of FFT frames in ring
constexpr size_t DEFAULT_FFT_SIZE = 2048;    // FFT bins per frame
constexpr size_t MAX_CHANNELS = 2;           // B210 has 2 RX channels

// ============================================================================
// Shared Memory Structures (must match Node.js reader)
// ============================================================================

#pragma pack(push, 1)

/**
 * Header at the start of shared memory region.
 * Contains metadata and synchronization primitives.
 */
struct SharedFFTHeader {
    uint32_t magic;              // SHM_MAGIC for validation
    uint32_t version;            // Protocol version
    uint32_t ring_size;          // Number of frames in ring buffer
    uint32_t fft_size;           // FFT bins per frame
    uint32_t channel_count;      // 1 or 2 channels
    uint32_t frame_size;         // Size of each FFTFrame in bytes

    // Atomic indices for lock-free synchronization
    // Write index: incremented by producer after writing frame
    // Read index: incremented by consumer after reading frame
    std::atomic<uint64_t> write_idx;
    std::atomic<uint64_t> read_idx;

    // Current hardware state
    double sample_rate;
    uint8_t gps_locked;
    uint8_t streaming;
    uint8_t reserved[6];

    // Padding to 64 bytes
    uint8_t padding[8];
};
static_assert(sizeof(SharedFFTHeader) == 64, "SharedFFTHeader must be 64 bytes");

/**
 * Per-frame header (one per FFT frame in ring buffer).
 * Followed by spectrum data: float[fft_size] per channel.
 * Note: Size varies by platform (44 bytes on ARM64, 48 on x86_64)
 */
struct FFTFrameHeader {
    uint64_t frame_number;       // Monotonic frame counter
    double timestamp;            // UHD timestamp (seconds)
    double center_freq;          // Center frequency (Hz)
    uint32_t fft_size;           // Bins in this frame
    uint16_t channel_mask;       // Bit 0: ch0 valid, Bit 1: ch1 valid
    uint16_t flags;              // Bit 0: GPS locked, Bit 1: overflow
    int16_t peak_bin[MAX_CHANNELS];    // Peak bin per channel
    float peak_power[MAX_CHANNELS];    // Peak power per channel (dBFS)
    // Followed by: float spectrum[channel_count][fft_size]
};
// Platform-portable size check
static_assert(sizeof(FFTFrameHeader) >= 44 && sizeof(FFTFrameHeader) <= 52,
              "FFTFrameHeader size unexpected - check struct packing");

#pragma pack(pop)

// ============================================================================
// Producer (C++ side) - Writes FFT data to shared memory
// ============================================================================

class SharedFFTProducer {
public:
    SharedFFTProducer(size_t ring_size = DEFAULT_RING_SIZE,
                      size_t fft_size = DEFAULT_FFT_SIZE,
                      size_t channel_count = 1)
        : ring_size_(ring_size), fft_size_(fft_size), channel_count_(channel_count)
    {
        // Calculate sizes
        frame_data_size_ = fft_size * channel_count * sizeof(float);
        frame_size_ = sizeof(FFTFrameHeader) + frame_data_size_;
        total_size_ = sizeof(SharedFFTHeader) + ring_size * frame_size_;

        // Create shared memory
        fd_ = shm_open(SHM_NAME, O_CREAT | O_RDWR, 0666);
        if (fd_ < 0) {
            throw std::runtime_error("Failed to create shared memory: " +
                                    std::string(strerror(errno)));
        }

        // Set size
        if (ftruncate(fd_, total_size_) < 0) {
            close(fd_);
            shm_unlink(SHM_NAME);
            throw std::runtime_error("Failed to set shared memory size: " +
                                    std::string(strerror(errno)));
        }

        // Map memory
        void* ptr = mmap(nullptr, total_size_, PROT_READ | PROT_WRITE,
                        MAP_SHARED, fd_, 0);
        if (ptr == MAP_FAILED) {
            close(fd_);
            shm_unlink(SHM_NAME);
            throw std::runtime_error("Failed to map shared memory: " +
                                    std::string(strerror(errno)));
        }

        base_ = static_cast<uint8_t*>(ptr);
        header_ = reinterpret_cast<SharedFFTHeader*>(base_);
        frames_base_ = base_ + sizeof(SharedFFTHeader);

        // Initialize header
        header_->magic = SHM_MAGIC;
        header_->version = SHM_VERSION;
        header_->ring_size = ring_size;
        header_->fft_size = fft_size;
        header_->channel_count = channel_count;
        header_->frame_size = frame_size_;
        header_->write_idx.store(0, std::memory_order_relaxed);
        header_->read_idx.store(0, std::memory_order_relaxed);
        header_->sample_rate = 0;
        header_->gps_locked = 0;
        header_->streaming = 1;

        std::cerr << "[SharedMem] Created " << SHM_NAME << " ("
                  << (total_size_ / 1024) << " KB, "
                  << ring_size << " frames × " << fft_size << " bins × "
                  << channel_count << " channels)" << std::endl;
    }

    ~SharedFFTProducer() {
        if (header_) {
            header_->streaming = 0;
        }
        if (base_) {
            munmap(base_, total_size_);
        }
        if (fd_ >= 0) {
            close(fd_);
            shm_unlink(SHM_NAME);
        }
        std::cerr << "[SharedMem] Destroyed " << SHM_NAME << std::endl;
    }

    // Non-copyable
    SharedFFTProducer(const SharedFFTProducer&) = delete;
    SharedFFTProducer& operator=(const SharedFFTProducer&) = delete;

    /**
     * Publish a single-channel FFT frame.
     */
    void publish(uint64_t frame_num, double timestamp, double center_freq,
                 const float* spectrum, size_t fft_size,
                 int16_t peak_bin, float peak_power, bool gps_locked) {
        publish_multi(frame_num, timestamp, center_freq,
                     &spectrum, 1, fft_size,
                     &peak_bin, &peak_power, gps_locked);
    }

    /**
     * Publish a multi-channel FFT frame.
     * spectrum_channels: array of pointers to spectrum data per channel
     */
    void publish_multi(uint64_t frame_num, double timestamp, double center_freq,
                       const float* const* spectrum_channels, size_t num_channels,
                       size_t fft_size, const int16_t* peak_bins,
                       const float* peak_powers, bool gps_locked) {
        // Get next write slot
        uint64_t write_idx = header_->write_idx.load(std::memory_order_relaxed);
        size_t slot = write_idx % ring_size_;

        // Get frame pointer
        uint8_t* frame_ptr = frames_base_ + slot * frame_size_;
        FFTFrameHeader* frame = reinterpret_cast<FFTFrameHeader*>(frame_ptr);
        float* data = reinterpret_cast<float*>(frame_ptr + sizeof(FFTFrameHeader));

        // Fill frame header
        frame->frame_number = frame_num;
        frame->timestamp = timestamp;
        frame->center_freq = center_freq;
        frame->fft_size = fft_size;
        frame->channel_mask = (1 << num_channels) - 1;  // Set bits for valid channels
        frame->flags = gps_locked ? 0x0001 : 0x0000;

        // Copy per-channel data
        for (size_t ch = 0; ch < num_channels && ch < MAX_CHANNELS; ++ch) {
            frame->peak_bin[ch] = peak_bins[ch];
            frame->peak_power[ch] = peak_powers[ch];

            // Copy spectrum data
            std::memcpy(data + ch * fft_size_, spectrum_channels[ch],
                       fft_size * sizeof(float));
        }

        // Memory barrier and publish
        std::atomic_thread_fence(std::memory_order_release);
        header_->write_idx.store(write_idx + 1, std::memory_order_release);

        // Update header state
        header_->gps_locked = gps_locked ? 1 : 0;
    }

    void set_sample_rate(double rate) {
        header_->sample_rate = rate;
    }

    size_t ring_size() const { return ring_size_; }
    size_t fft_size() const { return fft_size_; }
    size_t channel_count() const { return channel_count_; }

private:
    int fd_ = -1;
    uint8_t* base_ = nullptr;
    SharedFFTHeader* header_ = nullptr;
    uint8_t* frames_base_ = nullptr;

    size_t ring_size_;
    size_t fft_size_;
    size_t channel_count_;
    size_t frame_data_size_;
    size_t frame_size_;
    size_t total_size_;
};

// ============================================================================
// Consumer (for testing in C++ - Node.js uses its own implementation)
// ============================================================================

class SharedFFTConsumer {
public:
    SharedFFTConsumer() {
        // Open existing shared memory
        fd_ = shm_open(SHM_NAME, O_RDONLY, 0);
        if (fd_ < 0) {
            throw std::runtime_error("Failed to open shared memory: " +
                                    std::string(strerror(errno)));
        }

        // Get size from header
        struct stat sb;
        if (fstat(fd_, &sb) < 0) {
            close(fd_);
            throw std::runtime_error("Failed to stat shared memory");
        }
        total_size_ = sb.st_size;

        // Map memory read-only
        void* ptr = mmap(nullptr, total_size_, PROT_READ, MAP_SHARED, fd_, 0);
        if (ptr == MAP_FAILED) {
            close(fd_);
            throw std::runtime_error("Failed to map shared memory");
        }

        base_ = static_cast<const uint8_t*>(ptr);
        header_ = reinterpret_cast<const SharedFFTHeader*>(base_);

        // Validate
        if (header_->magic != SHM_MAGIC) {
            munmap(const_cast<uint8_t*>(base_), total_size_);
            close(fd_);
            throw std::runtime_error("Invalid shared memory magic");
        }

        frames_base_ = base_ + sizeof(SharedFFTHeader);
        last_read_idx_ = header_->write_idx.load(std::memory_order_acquire);
    }

    ~SharedFFTConsumer() {
        if (base_) {
            munmap(const_cast<uint8_t*>(base_), total_size_);
        }
        if (fd_ >= 0) {
            close(fd_);
        }
    }

    /**
     * Try to read the next available frame.
     * Returns nullptr if no new frame available.
     */
    const FFTFrameHeader* try_read() {
        uint64_t write_idx = header_->write_idx.load(std::memory_order_acquire);

        if (last_read_idx_ >= write_idx) {
            return nullptr;  // No new data
        }

        // Check if we've fallen too far behind
        if (write_idx - last_read_idx_ > header_->ring_size) {
            // Skip to most recent
            last_read_idx_ = write_idx - 1;
        }

        size_t slot = last_read_idx_ % header_->ring_size;
        const uint8_t* frame_ptr = frames_base_ + slot * header_->frame_size;

        last_read_idx_++;
        return reinterpret_cast<const FFTFrameHeader*>(frame_ptr);
    }

    const float* get_spectrum(const FFTFrameHeader* frame, size_t channel = 0) const {
        const uint8_t* frame_ptr = reinterpret_cast<const uint8_t*>(frame);
        const float* data = reinterpret_cast<const float*>(
            frame_ptr + sizeof(FFTFrameHeader));
        return data + channel * header_->fft_size;
    }

    const SharedFFTHeader* header() const { return header_; }
    bool is_streaming() const { return header_->streaming != 0; }

private:
    int fd_ = -1;
    const uint8_t* base_ = nullptr;
    const SharedFFTHeader* header_ = nullptr;
    const uint8_t* frames_base_ = nullptr;
    size_t total_size_ = 0;
    uint64_t last_read_idx_ = 0;
};

}  // namespace sdr
