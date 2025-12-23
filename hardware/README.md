# Hardware Integration - UHD Streaming Daemon

This directory contains the C++ UHD streaming daemon that interfaces with the Ettus B210 SDR hardware.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Ettus B210    │ ◄─USB─► │  sdr_streamer    │ ─JSON─► │   Node.js    │
│   USRP SDR      │         │  (C++ + UHD)     │  stdout │   Server     │
└─────────────────┘         └──────────────────┘         └──────────────┘
                                     │                            │
                                     ▼                            ▼
                              FFT Computation              WebSocket Clients
                              (FFTW3)                      (Browser UI)
```

## Dependencies

### Ubuntu/Debian (ARM64 or x86_64)
```bash
# Update package list
sudo apt-get update

# Install UHD library and tools
sudo apt-get install -y libuhd-dev uhd-host

# Install FFTW3 (single-precision)
sudo apt-get install -y libfftw3-dev libfftw3-single3

# Install build tools
sudo apt-get install -y build-essential cmake git

# Download UHD FPGA images (required for B210)
sudo uhd_images_downloader
```

### Verify UHD Installation
```bash
# Check UHD version
uhd_find_devices

# Test B210 connection (with hardware plugged in)
uhd_usrp_probe

# Expected output should show:
# - Device: B200
# - Mboard: B210
# - RX/TX channels
```

## Building

```bash
cd hardware

# Create build directory
mkdir -p build
cd build

# Configure with CMake
cmake ..

# Build
make -j$(nproc)

# Install (optional)
sudo make install
```

The compiled binary will be at: `hardware/build/sdr_streamer`

## Usage

### Basic Usage
```bash
./sdr_streamer --freq 915 --rate 10 --gain 50
```

### Command Line Arguments
- `--freq <MHz>`: Center frequency in MHz (default: 915)
- `--rate <MSPS>`: Sample rate in MSPS (default: 10)
- `--gain <dB>`: RX gain in dB (default: 50)
- `--fft-size <N>`: FFT size (default: 2048)
- `--device <args>`: UHD device args (default: auto-detect)
- `--subdev <spec>`: Subdevice spec (default: "A:A")
- `--ant <name>`: Antenna selection (default: "TX/RX")
- `--bw <MHz>`: Analog bandwidth in MHz (default: auto)

### Examples

**FM Radio Band (88-108 MHz)**
```bash
./sdr_streamer --freq 98.5 --rate 2.4 --gain 40
```

**ISM Band (915 MHz)**
```bash
./sdr_streamer --freq 915 --rate 10 --gain 50
```

**Wide Spectrum Scan (2.4 GHz WiFi)**
```bash
./sdr_streamer --freq 2437 --rate 20 --gain 30
```

**Low Gain for Strong Signals**
```bash
./sdr_streamer --freq 915 --rate 10 --gain 20
```

## Output Format

The daemon outputs JSON FFT data to stdout, one line per FFT frame (~60 FPS):

```json
{
  "type": "fft",
  "timestamp": 1704067200000,
  "centerFrequency": 915.0,
  "sampleRate": 10.0,
  "fftSize": 2048,
  "data": [-95.2, -94.8, -93.5, ..., -96.1]
}
```

- `timestamp`: Unix timestamp in milliseconds
- `centerFrequency`: Center frequency in MHz
- `sampleRate`: Sample rate in MSPS
- `fftSize`: Number of FFT bins
- `data`: Array of FFT magnitude values in dBFS (FFT-shifted)

## Integration with Node.js

The Node.js server (`server/hardware-manager.ts`) spawns this process and:
1. Parses JSON output from stdout
2. Broadcasts FFT data to WebSocket clients
3. Handles process lifecycle (start/stop/restart)
4. Monitors for errors and implements reconnection

### Automatic Mode
When no `sdr_streamer` binary is found, the system falls back to **simulated mode** with fake FFT data for testing without hardware.

## Troubleshooting

### "No UHD devices found"
```bash
# Check USB connection
lsusb | grep Ettus

# Expected output:
# Bus 001 Device 005: ID 2500:0020 Ettus Research LLC USRP B200

# Check permissions
sudo usermod -a -G usb $USER
# Log out and back in

# Try with sudo (not recommended for production)
sudo ./sdr_streamer --freq 915 --rate 10 --gain 50
```

### "Timeout waiting for samples"
- Check USB cable quality (use USB 3.0)
- Reduce sample rate: `--rate 5` instead of `--rate 20`
- Check system load: `top` or `htop`

### "Overflow detected"
- System cannot keep up with sample rate
- Reduce sample rate or FFT size
- Close other applications
- Check CPU governor: `cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor`
  - Should be "performance" not "powersave"

### Build Errors

**"uhd/usrp/multi_usrp.hpp: No such file or directory"**
```bash
sudo apt-get install libuhd-dev
```

**"cannot find -lfftw3f"**
```bash
sudo apt-get install libfftw3-dev
```

**CMake version too old**
```bash
# Install newer CMake from Kitware
wget -O - https://apt.kitware.com/keys/kitware-archive-latest.asc 2>/dev/null | gpg --dearmor - | sudo tee /etc/apt/trusted.gpg.d/kitware.gpg >/dev/null
sudo apt-add-repository 'deb https://apt.kitware.com/ubuntu/ focal main'
sudo apt-get update
sudo apt-get install cmake
```

## Performance Tuning

### CPU Governor (ARM64 / Jetson)
```bash
# Set to performance mode
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### USB Buffer Size
```bash
# Increase USB buffer size for high sample rates
echo 128 | sudo tee /sys/module/usbcore/parameters/usbfs_memory_mb
```

### Real-time Priority
```bash
# Run with real-time priority (requires root or CAP_SYS_NICE)
sudo chrt -f 50 ./sdr_streamer --freq 915 --rate 20 --gain 50
```

## Development

### Adding New Features

**Custom Windowing Functions**
Edit `sdr_streamer.cpp`, modify the `FFTProcessor` constructor:
```cpp
// Blackman window instead of Hann
for (size_t i = 0; i < fft_size_; ++i) {
    double a0 = 0.42, a1 = 0.5, a2 = 0.08;
    window_[i] = a0 - a1 * cos(2.0 * M_PI * i / (fft_size_ - 1))
                    + a2 * cos(4.0 * M_PI * i / (fft_size_ - 1));
}
```

**Dynamic Gain Control (AGC)**
Add AGC logic in the main loop:
```cpp
// Compute average power
float avg_power = 0;
for (const auto& val : fft_data) {
    avg_power += std::pow(10.0, val / 10.0);
}
avg_power /= fft_data.size();

// Adjust gain to target -60 dBFS
double target_db = -60.0;
double current_db = 10.0 * std::log10(avg_power);
double gain_adjustment = target_db - current_db;
usrp->set_rx_gain(usrp->get_rx_gain() + gain_adjustment);
```

### Debugging

**Enable verbose UHD logging**
```bash
export UHD_LOG_LEVEL=debug
./sdr_streamer --freq 915 --rate 10 --gain 50
```

**Profile with perf**
```bash
sudo perf record -g ./sdr_streamer --freq 915 --rate 10 --gain 50
sudo perf report
```

## Systemd Service (Production Deployment)

Create `/etc/systemd/system/sdr-streamer.service`:
```ini
[Unit]
Description=SDR Streamer for Ettus B210
After=network.target

[Service]
Type=simple
User=sdr
Group=usb
ExecStart=/usr/local/bin/sdr_streamer --freq 915 --rate 10 --gain 50
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sdr-streamer
sudo systemctl start sdr-streamer
sudo systemctl status sdr-streamer
```

## License

This code interfaces with UHD (USRP Hardware Driver), which is licensed under GPL v3.
FFTW3 is licensed under GPL v2 or later.

Ensure compliance with these licenses in your deployment.
