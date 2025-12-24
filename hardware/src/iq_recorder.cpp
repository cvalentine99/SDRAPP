/**
 * iq_recorder.cpp - IQ Sample Recording Daemon
 *
 * Records raw IQ samples from Ettus B210 to file for offline analysis.
 * Supports configurable duration, sample rate, and frequency.
 *
 * Features:
 * - Async file I/O with ring buffer to prevent sample drops
 * - Separate writer thread for non-blocking disk operations
 * - Overflow detection and reporting
 *
 * Usage:
 *   ./iq_recorder --freq 915e6 --rate 10e6 --gain 50 --duration 10 --output recording.dat
 *
 * Output format: Complex float32 (I/Q interleaved), SigMF compatible
 */

#include <uhd/usrp/multi_usrp.hpp>
#include <uhd/utils/safe_main.hpp>
#include <uhd/utils/thread.hpp>
#include <boost/program_options.hpp>
#include <boost/format.hpp>
#include <iostream>
#include <fstream>
#include <csignal>
#include <complex>
#include <vector>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <atomic>
#include <queue>
#include <chrono>

namespace po = boost::program_options;

// ============================================================================
// Global state
// ============================================================================

static std::atomic<bool> stop_signal_called{false};

void sig_int_handler(int) {
    stop_signal_called = true;
}

// ============================================================================
// Async File Writer with Ring Buffer
// ============================================================================

class AsyncFileWriter {
public:
    // Ring buffer block size (number of samples per block)
    static constexpr size_t BLOCK_SIZE = 65536;  // 64K samples = 512 KB per block
    static constexpr size_t MAX_QUEUE_SIZE = 64; // Max blocks in queue (32 MB buffer)

    AsyncFileWriter(const std::string& path)
        : running_(true), total_written_(0), dropped_blocks_(0)
    {
        file_.open(path, std::ios::binary);
        if (!file_.is_open()) {
            throw std::runtime_error("Failed to open output file: " + path);
        }

        // Pre-allocate block pool
        for (size_t i = 0; i < MAX_QUEUE_SIZE; ++i) {
            free_blocks_.push(std::make_unique<Block>());
        }

        // Start writer thread
        writer_thread_ = std::thread(&AsyncFileWriter::writer_loop, this);
        std::cerr << "[AsyncWriter] Started with " << MAX_QUEUE_SIZE << " block ring buffer ("
                  << (MAX_QUEUE_SIZE * BLOCK_SIZE * sizeof(std::complex<float>) / 1024 / 1024)
                  << " MB)" << std::endl;
    }

    ~AsyncFileWriter() {
        // Signal writer thread to finish
        running_ = false;
        queue_cv_.notify_one();

        if (writer_thread_.joinable()) {
            writer_thread_.join();
        }

        file_.close();
    }

    // Write samples to the async buffer (called from receiver thread)
    // Returns number of samples actually queued (may be less if buffer full)
    size_t write(const std::complex<float>* data, size_t count) {
        size_t written = 0;

        while (written < count && running_) {
            // Get a free block
            std::unique_ptr<Block> block;
            {
                std::lock_guard<std::mutex> lock(free_mutex_);
                if (!free_blocks_.empty()) {
                    block = std::move(free_blocks_.front());
                    free_blocks_.pop();
                }
            }

            if (!block) {
                // No free blocks - buffer overrun
                dropped_blocks_++;
                if (dropped_blocks_ == 1 || dropped_blocks_ % 100 == 0) {
                    std::cerr << "\r[AsyncWriter] WARNING: Buffer overrun, "
                              << dropped_blocks_ << " blocks dropped" << std::endl;
                }
                // Skip this batch to catch up
                return written;
            }

            // Fill the block
            size_t to_copy = std::min(count - written, BLOCK_SIZE);
            block->count = to_copy;
            std::memcpy(block->data.data(), data + written, to_copy * sizeof(std::complex<float>));
            written += to_copy;

            // Queue the block for writing
            {
                std::lock_guard<std::mutex> lock(queue_mutex_);
                write_queue_.push(std::move(block));
            }
            queue_cv_.notify_one();
        }

        return written;
    }

    // Get statistics
    size_t total_written() const { return total_written_; }
    size_t dropped_blocks() const { return dropped_blocks_; }
    size_t queue_depth() const {
        std::lock_guard<std::mutex> lock(queue_mutex_);
        return write_queue_.size();
    }

private:
    struct Block {
        std::array<std::complex<float>, BLOCK_SIZE> data;
        size_t count = 0;
    };

    void writer_loop() {
        while (running_ || !write_queue_.empty()) {
            std::unique_ptr<Block> block;

            // Wait for a block to write
            {
                std::unique_lock<std::mutex> lock(queue_mutex_);
                queue_cv_.wait(lock, [this] {
                    return !write_queue_.empty() || !running_;
                });

                if (write_queue_.empty()) {
                    continue;
                }

                block = std::move(write_queue_.front());
                write_queue_.pop();
            }

            // Write block to disk
            if (block && block->count > 0) {
                file_.write(reinterpret_cast<const char*>(block->data.data()),
                           block->count * sizeof(std::complex<float>));
                total_written_ += block->count;
            }

            // Return block to free pool
            if (block) {
                std::lock_guard<std::mutex> lock(free_mutex_);
                free_blocks_.push(std::move(block));
            }
        }

        // Flush any remaining data
        file_.flush();
    }

    std::ofstream file_;
    std::atomic<bool> running_;
    std::atomic<size_t> total_written_;
    std::atomic<size_t> dropped_blocks_;

    // Block pools
    std::queue<std::unique_ptr<Block>> free_blocks_;
    std::mutex free_mutex_;

    std::queue<std::unique_ptr<Block>> write_queue_;
    mutable std::mutex queue_mutex_;
    std::condition_variable queue_cv_;

    std::thread writer_thread_;
};

// ============================================================================
// Main
// ============================================================================

int UHD_SAFE_MAIN(int argc, char *argv[]) {
    // Set thread priority
    uhd::set_thread_priority_safe();

    // Command line options
    std::string device_args, output_file;
    double freq, rate, gain, duration;
    size_t buffer_size;

    po::options_description desc("IQ Recorder Options");
    desc.add_options()
        ("help", "Show help message")
        ("args", po::value<std::string>(&device_args)->default_value(""), "UHD device args")
        ("freq", po::value<double>(&freq)->default_value(915e6), "Center frequency (Hz)")
        ("rate", po::value<double>(&rate)->default_value(10e6), "Sample rate (Hz)")
        ("gain", po::value<double>(&gain)->default_value(50), "RX gain (dB)")
        ("duration", po::value<double>(&duration)->default_value(10.0), "Recording duration (seconds)")
        ("output", po::value<std::string>(&output_file)->default_value("recording.dat"), "Output file path")
        ("buffer", po::value<size_t>(&buffer_size)->default_value(8192), "RX buffer size (samples)")
    ;

    po::variables_map vm;
    po::store(po::parse_command_line(argc, argv, desc), vm);
    po::notify(vm);

    if (vm.count("help")) {
        std::cout << desc << std::endl;
        return EXIT_SUCCESS;
    }

    std::cerr << "[IQ Recorder] Starting with async file I/O..." << std::endl;
    std::cerr << "  Frequency: " << freq / 1e6 << " MHz" << std::endl;
    std::cerr << "  Sample Rate: " << rate / 1e6 << " MSPS" << std::endl;
    std::cerr << "  RX Gain: " << gain << " dB" << std::endl;
    std::cerr << "  Duration: " << duration << " seconds" << std::endl;
    std::cerr << "  Output: " << output_file << std::endl;
    std::cerr << "  Expected file size: "
              << (duration * rate * sizeof(std::complex<float>) / 1024 / 1024)
              << " MB" << std::endl;

    // Create USRP device
    std::cerr << "[IQ Recorder] Creating USRP device..." << std::endl;
    uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make(device_args);

    // Set sample rate
    usrp->set_rx_rate(rate);
    double actual_rate = usrp->get_rx_rate();
    std::cerr << "[IQ Recorder] Actual sample rate: " << actual_rate / 1e6 << " MSPS" << std::endl;

    // Set center frequency
    uhd::tune_request_t tune_request(freq);
    usrp->set_rx_freq(tune_request);
    double actual_freq = usrp->get_rx_freq();
    std::cerr << "[IQ Recorder] Actual frequency: " << actual_freq / 1e6 << " MHz" << std::endl;

    // Set RX gain
    usrp->set_rx_gain(gain);
    double actual_gain = usrp->get_rx_gain();
    std::cerr << "[IQ Recorder] Actual RX gain: " << actual_gain << " dB" << std::endl;

    // Set antenna
    usrp->set_rx_antenna("TX/RX");

    // Allow time for device to settle
    std::this_thread::sleep_for(std::chrono::seconds(1));

    // Create RX streamer
    uhd::stream_args_t stream_args("fc32", "sc16");
    uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);

    // Create async file writer
    std::unique_ptr<AsyncFileWriter> writer;
    try {
        writer = std::make_unique<AsyncFileWriter>(output_file);
    } catch (const std::exception& e) {
        std::cerr << "[IQ Recorder] ERROR: " << e.what() << std::endl;
        return EXIT_FAILURE;
    }

    // Setup streaming
    uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
    stream_cmd.stream_now = true;
    rx_stream->issue_stream_cmd(stream_cmd);

    // Allocate receive buffer
    std::vector<std::complex<float>> buffer(buffer_size);
    uhd::rx_metadata_t md;

    // Calculate total samples to record
    size_t total_samples = static_cast<size_t>(duration * actual_rate);
    size_t samples_received = 0;
    size_t overflow_count = 0;

    // Register signal handler
    std::signal(SIGINT, &sig_int_handler);
    std::signal(SIGTERM, &sig_int_handler);

    std::cerr << "[IQ Recorder] Recording started..." << std::endl;

    auto start_time = std::chrono::steady_clock::now();
    auto last_progress_time = start_time;

    // Recording loop - receiver thread (this thread)
    while (!stop_signal_called && samples_received < total_samples) {
        size_t num_rx_samps = rx_stream->recv(&buffer.front(), buffer.size(), md, 3.0);

        if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_TIMEOUT) {
            std::cerr << "\r[IQ Recorder] WARNING: Timeout waiting for samples" << std::endl;
            continue;
        }
        if (md.error_code == uhd::rx_metadata_t::ERROR_CODE_OVERFLOW) {
            overflow_count++;
            if (overflow_count == 1 || overflow_count % 100 == 0) {
                std::cerr << "\r[IQ Recorder] WARNING: Overflow #" << overflow_count << std::endl;
            }
            continue;
        }
        if (md.error_code != uhd::rx_metadata_t::ERROR_CODE_NONE) {
            std::cerr << "\r[IQ Recorder] ERROR: " << md.strerror() << std::endl;
            break;
        }

        // Queue samples for async writing
        writer->write(&buffer.front(), num_rx_samps);
        samples_received += num_rx_samps;

        // Progress update every second
        auto now = std::chrono::steady_clock::now();
        if (std::chrono::duration_cast<std::chrono::milliseconds>(now - last_progress_time).count() >= 1000) {
            double progress = 100.0 * samples_received / total_samples;
            size_t queue_depth = writer->queue_depth();
            std::cerr << boost::format("\r[IQ Recorder] Progress: %.1f%% | Queue: %zu blocks | Written: %.1f MB")
                         % progress % queue_depth % (writer->total_written() * sizeof(std::complex<float>) / 1024.0 / 1024.0)
                      << std::flush;
            last_progress_time = now;
        }
    }

    std::cerr << std::endl;

    // Stop streaming
    stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
    rx_stream->issue_stream_cmd(stream_cmd);

    // Wait for writer to flush
    std::cerr << "[IQ Recorder] Flushing remaining data..." << std::endl;
    writer.reset();  // Destructor waits for writer thread

    auto end_time = std::chrono::steady_clock::now();
    auto recording_duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count() / 1000.0;

    std::cerr << "[IQ Recorder] Recording complete!" << std::endl;
    std::cerr << "  Samples received: " << samples_received << std::endl;
    std::cerr << "  Duration: " << recording_duration << " seconds" << std::endl;
    std::cerr << "  File size: " << (samples_received * sizeof(std::complex<float>) / 1024.0 / 1024.0) << " MB" << std::endl;
    std::cerr << "  Output: " << output_file << std::endl;

    if (overflow_count > 0) {
        std::cerr << "  WARNING: " << overflow_count << " USB overflows detected" << std::endl;
    }
    if (writer && writer->dropped_blocks() > 0) {
        std::cerr << "  WARNING: " << writer->dropped_blocks() << " blocks dropped (disk too slow)" << std::endl;
    }

    // Output SigMF-compatible JSON metadata to stdout
    std::cout << "{" << std::endl;
    std::cout << "  \"global\": {" << std::endl;
    std::cout << "    \"core:datatype\": \"cf32_le\"," << std::endl;
    std::cout << "    \"core:sample_rate\": " << actual_rate << "," << std::endl;
    std::cout << "    \"core:version\": \"1.0.0\"," << std::endl;
    std::cout << "    \"core:description\": \"Ettus B210 IQ recording at " << (actual_freq / 1e6) << " MHz\"" << std::endl;
    std::cout << "  }," << std::endl;
    std::cout << "  \"captures\": [{" << std::endl;
    std::cout << "    \"core:sample_start\": 0," << std::endl;
    std::cout << "    \"core:frequency\": " << actual_freq << std::endl;
    std::cout << "  }]," << std::endl;
    std::cout << "  \"annotations\": []" << std::endl;
    std::cout << "}" << std::endl;

    return EXIT_SUCCESS;
}
