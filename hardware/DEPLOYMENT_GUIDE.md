# Ettus B210 SDR - Hardware Deployment Guide

**Target System:** gx10-alpha ARM64 bare metal server  
**Date:** December 24, 2025  
**Author:** Manus AI

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Installation Steps](#detailed-installation-steps)
5. [Compilation](#compilation)
6. [Verification](#verification)
7. [Integration with Web Application](#integration-with-web-application)
8. [Troubleshooting](#troubleshooting)
9. [Performance Tuning](#performance-tuning)

---

## Overview

This guide walks you through compiling the three C++ hardware daemons required for Ettus B210 SDR integration:

- **sdr_streamer** - Real-time FFT streaming daemon (60 FPS)
- **freq_scanner** - Frequency range scanner with peak detection
- **iq_recorder** - IQ sample recorder with SigMF format support

These daemons interface directly with the Ettus B210 hardware via UHD (USRP Hardware Driver) and provide JSON output that the Node.js backend consumes.

---

## Prerequisites

### Hardware Requirements

- **Ettus B210 USRP** (50 MHz - 6 GHz, USB 3.0)
- **USB 3.0 port** on gx10-alpha server (USB 2.0 will work but with reduced sample rates)
- **ARM64 Linux system** (Ubuntu 20.04+ or Debian 11+ recommended)

### System Requirements

- **RAM:** 4 GB minimum, 8 GB recommended
- **Storage:** 2 GB free space for UHD and dependencies
- **CPU:** ARM64 multi-core processor (4+ cores recommended for real-time FFT)

### Software Requirements

- Ubuntu 20.04+ or Debian 11+ (ARM64)
- Root or sudo access
- Internet connection for downloading dependencies

---

## Quick Start

If you're familiar with Linux compilation and just want to get started quickly:

```bash
# 1. Transfer hardware directory to gx10-alpha
scp -r hardware/ user@gx10-alpha:~/ettus-sdr-hardware/

# 2. SSH into gx10-alpha
ssh user@gx10-alpha

# 3. Install dependencies (takes 10-30 minutes)
cd ~/ettus-sdr-hardware
chmod +x install_dependencies.sh
./install_dependencies.sh

# 4. Compile binaries (takes 2-5 minutes)
mkdir -p build && cd build
cmake ..
make -j$(nproc)

# 5. Verify build
cd ..
./verify_build.sh

# 6. Test with hardware
./build/bin/sdr_streamer --freq 915e6 --rate 10e6 --gain 40
```

---

## Detailed Installation Steps

### Step 1: Transfer Hardware Directory

From your local machine (where this repository is located):

```bash
# Create tarball of hardware directory
cd /path/to/ettus-sdr-web
tar -czf hardware-deployment.tar.gz hardware/

# Transfer to gx10-alpha
scp hardware-deployment.tar.gz user@gx10-alpha:~/

# SSH into gx10-alpha
ssh user@gx10-alpha

# Extract
cd ~
tar -xzf hardware-deployment.tar.gz
cd hardware/
```

### Step 2: Install Dependencies

The `install_dependencies.sh` script automates the installation of all required libraries:

```bash
chmod +x install_dependencies.sh
./install_dependencies.sh
```

**What this script does:**

1. Updates package lists
2. Installs build tools (gcc, g++, cmake, git)
3. Installs Boost libraries (all components)
4. Installs libusb for USB communication
5. Installs FFTW3 for FFT computation
6. Installs JSON libraries (nlohmann-json)
7. **Compiles and installs UHD from source** (v4.6.0.0)
8. Downloads UHD FPGA images for B210
9. Configures USB permissions via udev rules

**Expected duration:** 10-30 minutes (UHD compilation is the longest step)

**Troubleshooting installation:**

If the script fails, check:
- Internet connection is stable
- Sufficient disk space (2 GB free)
- ARM64 architecture: `uname -m` should show `aarch64`

To install UHD manually if the script fails:

```bash
# Clone UHD repository
git clone --branch v4.6.0.0 --depth 1 https://github.com/EttusResearch/uhd.git
cd uhd/host
mkdir build && cd build

# Configure (disable Python API for faster build)
cmake -DCMAKE_INSTALL_PREFIX=/usr/local \
      -DENABLE_PYTHON_API=OFF \
      -DENABLE_EXAMPLES=OFF \
      -DENABLE_TESTS=OFF \
      ..

# Compile (use all CPU cores)
make -j$(nproc)

# Install
sudo make install
sudo ldconfig

# Download FPGA images
sudo uhd_images_downloader -t b2xx
```

### Step 3: Verify UHD Installation

Before compiling the daemons, verify UHD is working:

```bash
# Check UHD version
uhd_find_devices --version

# Expected output:
# UHD 4.6.0.0 ...

# Connect B210 to USB 3.0 port, then:
uhd_find_devices

# Expected output should include:
# type: b200
# serial: 194919 (or your device's serial)

# Probe device for detailed info
uhd_usrp_probe --args='type=b200'

# This should show firmware, FPGA versions, frequency ranges, etc.
```

**If no device is found:**

1. Check USB cable is connected to USB 3.0 port (blue port)
2. Check USB permissions: `ls -l /dev/bus/usb/` should show your user has access
3. Try with sudo: `sudo uhd_find_devices`
4. Check dmesg for USB errors: `dmesg | tail -50`

---

## Compilation

### Step 4: Build C++ Daemons

```bash
cd ~/hardware
mkdir -p build
cd build

# Configure with CMake
cmake ..

# Expected output:
# -- Found UHD: /usr/local/lib/libuhd.so
# -- Found FFTW3: /usr/lib/aarch64-linux-gnu/libfftw3.so
# -- Configuring done
# -- Generating done

# Compile all three binaries
make -j$(nproc)

# Expected output:
# [ 33%] Building CXX object CMakeFiles/sdr_streamer.dir/src/sdr_streamer.cpp.o
# [ 66%] Building CXX object CMakeFiles/freq_scanner.dir/src/freq_scanner.cpp.o
# [100%] Building CXX object CMakeFiles/iq_recorder.dir/src/iq_recorder.cpp.o
# [100%] Built target sdr_streamer
# [100%] Built target freq_scanner
# [100%] Built target iq_recorder
```

**Compilation time:** 2-5 minutes on ARM64 (depends on CPU cores)

**Binaries location:** `build/bin/`

- `build/bin/sdr_streamer`
- `build/bin/freq_scanner`
- `build/bin/iq_recorder`

### Troubleshooting Compilation

**Error: "Could not find UHD"**

```bash
# Check if UHD is installed
pkg-config --modversion uhd

# If not found, set PKG_CONFIG_PATH
export PKG_CONFIG_PATH=/usr/local/lib/pkgconfig:$PKG_CONFIG_PATH

# Re-run cmake
cd build
rm CMakeCache.txt
cmake ..
```

**Error: "Could not find FFTW3"**

```bash
# Install FFTW3 development headers
sudo apt-get install libfftw3-dev

# Re-run cmake
cd build
rm CMakeCache.txt
cmake ..
```

**Error: "Boost not found"**

```bash
# Install all Boost libraries
sudo apt-get install libboost-all-dev

# Re-run cmake
cd build
rm CMakeCache.txt
cmake ..
```

---

## Verification

### Step 5: Run Build Verification Script

```bash
cd ~/hardware
./verify_build.sh
```

This script checks:

1. ✅ All three binaries exist and are executable
2. ✅ Library dependencies are satisfied (UHD, FFTW3, Boost)
3. ✅ Binaries can execute without errors
4. ✅ B210 device is detected by UHD

**Expected output:**

```
==================================
Ettus B210 SDR - Build Verification
==================================

Step 1: Checking build directory...
✅ Build directory exists

Step 2: Checking compiled binaries...
✅ sdr_streamer binary found
   Size: 1.2 MiB
   Executable: Yes
✅ freq_scanner binary found
   Size: 1.1 MiB
   Executable: Yes
✅ iq_recorder binary found
   Size: 1.0 MiB
   Executable: Yes

Step 3: Checking library dependencies...
✅ All libraries found
   ✅ UHD library linked
   ✅ FFTW3 library linked
   ✅ Boost libraries linked

Step 4: Testing binary execution...
✅ sdr_streamer executes without errors
✅ freq_scanner executes without errors
✅ iq_recorder executes without errors

Step 5: Checking UHD device detection...
✅ Ettus B210 device detected!

==================================
Build Verification Summary
==================================
Errors:   0
Warnings: 0

✅ BUILD VERIFICATION PASSED
```

### Step 6: Test Daemons Manually

**Test sdr_streamer (real-time FFT streaming):**

```bash
cd ~/hardware/build/bin

# Stream FFT data at 915 MHz, 10 MSPS, 40 dB gain
./sdr_streamer --freq 915e6 --rate 10e6 --gain 40

# Expected output: JSON objects streaming to stdout at ~60 FPS
# {"timestamp":1703462400123,"centerFreq":915000000.0,"sampleRate":10000000.0,"fftSize":2048,"fftData":[-80.5,-78.2,...]}

# Press Ctrl+C to stop
```

**Test freq_scanner (frequency range scanning):**

```bash
# Scan 900-930 MHz in 1 MHz steps
./freq_scanner --start 900e6 --stop 930e6 --step 1e6 --gain 40

# Expected output: JSON array with peak power at each frequency
# [{"frequency":900000000.0,"peakPower":-75.3},{"frequency":901000000.0,"peakPower":-78.1},...]
```

**Test iq_recorder (IQ sample recording):**

```bash
# Record 5 seconds of IQ data at 915 MHz
./iq_recorder --freq 915e6 --rate 10e6 --gain 40 --duration 5 --output /tmp/test.sigmf-data

# Expected output:
# Recording IQ samples...
# Progress: 20%
# Progress: 40%
# Progress: 60%
# Progress: 80%
# Progress: 100%
# Recording complete: 50000000 samples written to /tmp/test.sigmf-data
```

---

## Integration with Web Application

### Step 7: Configure Environment Variables

The Node.js backend needs to know where the compiled binaries are located.

**Option 1: System-wide installation (recommended)**

```bash
# Copy binaries to /usr/local/bin
sudo cp ~/hardware/build/bin/sdr_streamer /usr/local/bin/
sudo cp ~/hardware/build/bin/freq_scanner /usr/local/bin/
sudo cp ~/hardware/build/bin/iq_recorder /usr/local/bin/

# Set permissions
sudo chmod +x /usr/local/bin/sdr_streamer
sudo chmod +x /usr/local/bin/freq_scanner
sudo chmod +x /usr/local/bin/iq_recorder

# Binaries are now in PATH, no environment variable needed
```

**Option 2: Custom path (via environment variable)**

```bash
# Add to web application .env file
echo "SDR_STREAMER_PATH=$HOME/hardware/build/bin/sdr_streamer" >> /path/to/ettus-sdr-web/.env
echo "FREQ_SCANNER_PATH=$HOME/hardware/build/bin/freq_scanner" >> /path/to/ettus-sdr-web/.env
echo "IQ_RECORDER_PATH=$HOME/hardware/build/bin/iq_recorder" >> /path/to/ettus-sdr-web/.env
```

### Step 8: Set Production Mode

```bash
# Edit web application .env file
cd /path/to/ettus-sdr-web
nano .env

# Add or update:
SDR_MODE=production
```

### Step 9: Restart Web Application

```bash
# If using systemd service
sudo systemctl restart ettus-sdr-web

# Or if running manually
cd /path/to/ettus-sdr-web
pnpm run build
NODE_ENV=production node server/_core/index.js
```

### Step 10: Verify Production Mode

1. Open web application in browser
2. Navigate to **Settings** page
3. Check that "SDR Mode" shows **"Production"**
4. Navigate to **Spectrum** page
5. Click **START** button
6. You should see real-time FFT data from the B210 hardware

---

## Troubleshooting

### Problem: "sdr_streamer: command not found"

**Solution:**

```bash
# Check if binary exists
ls -l ~/hardware/build/bin/sdr_streamer

# If exists, add to PATH
export PATH=$HOME/hardware/build/bin:$PATH

# Or use absolute path in .env
echo "SDR_STREAMER_PATH=$HOME/hardware/build/bin/sdr_streamer" >> .env
```

### Problem: "UHD Error: No devices found"

**Solution:**

```bash
# Check USB connection
lsusb | grep 2500

# Should show:
# Bus 001 Device 005: ID 2500:0020 Ettus Research LLC USRP B200

# If not found, check cable and USB 3.0 port
# Try different USB port (blue = USB 3.0)

# Check USB permissions
ls -l /dev/bus/usb/001/005  # Replace with your device numbers

# If permission denied, add udev rules
sudo tee /etc/udev/rules.d/uhd-usrp.rules > /dev/null <<EOF
SUBSYSTEM=="usb", ATTR{idVendor}=="2500", ATTR{idProduct}=="0020", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="2500", ATTR{idProduct}=="0021", MODE="0666"
EOF

sudo udevadm control --reload-rules
sudo udevadm trigger

# Unplug and replug B210
```

### Problem: "Buffer overflow" errors

**Solution:**

```bash
# Reduce sample rate
./sdr_streamer --freq 915e6 --rate 5e6 --gain 40  # Try 5 MSPS instead of 10 MSPS

# Or increase USB buffer size
sudo sysctl -w net.core.rmem_max=50000000
sudo sysctl -w net.core.wmem_max=50000000
```

### Problem: Low FFT frame rate (< 30 FPS)

**Solution:**

```bash
# Reduce FFT size (faster computation)
./sdr_streamer --freq 915e6 --rate 10e6 --gain 40 --fft-size 1024  # Default is 2048

# Or increase CPU governor to performance mode
sudo cpufreq-set -g performance
```

### Problem: "JSON parse error" in web application logs

**Solution:**

```bash
# Test sdr_streamer output manually
./sdr_streamer --freq 915e6 --rate 10e6 --gain 40 | head -5

# Should output valid JSON lines
# If output is corrupted, check stderr:
./sdr_streamer --freq 915e6 --rate 10e6 --gain 40 2>&1 | tee /tmp/sdr_debug.log
```

---

## Performance Tuning

### Optimize for Real-Time FFT Streaming

1. **Use USB 3.0 port** (blue port) for maximum bandwidth
2. **Disable CPU frequency scaling:**

```bash
sudo cpufreq-set -g performance
```

3. **Increase USB buffer sizes:**

```bash
sudo sysctl -w net.core.rmem_max=50000000
sudo sysctl -w net.core.wmem_max=50000000
```

4. **Reduce FFT size** if frame rate drops below 30 FPS:

```bash
# In server/hardware/production-hardware.ts, modify spawn args:
args: ['--fft-size', '1024']  // Instead of 2048
```

5. **Use dedicated CPU cores** for sdr_streamer:

```bash
# Pin sdr_streamer to specific CPU cores
taskset -c 0,1 ./sdr_streamer --freq 915e6 --rate 10e6 --gain 40
```

### Optimize for Frequency Scanning

1. **Reduce averaging** for faster scans:

```bash
./freq_scanner --start 900e6 --stop 930e6 --step 1e6 --gain 40 --avg 1
```

2. **Increase step size** for coarse scans:

```bash
./freq_scanner --start 900e6 --stop 930e6 --step 5e6 --gain 40  # 5 MHz steps
```

### Optimize for IQ Recording

1. **Use SSD storage** for high sample rates (> 20 MSPS)
2. **Pre-allocate disk space** for large recordings:

```bash
fallocate -l 10G /path/to/recording.sigmf-data
```

3. **Monitor disk I/O** during recording:

```bash
iostat -x 1  # Watch for %util approaching 100%
```

---

## Additional Resources

- **UHD Documentation:** https://files.ettus.com/manual/
- **B210 Specifications:** https://www.ettus.com/all-products/ub200-kit/
- **SigMF Format:** https://github.com/gnuradio/SigMF
- **FFTW3 Documentation:** http://www.fftw.org/fftw3_doc/

---

## Support

For issues with:

- **Hardware compilation:** Check `hardware/BUILD_INSTRUCTIONS.md`
- **Web application deployment:** Check `PRODUCTION_DEPLOYMENT.md`
- **UHD/B210 hardware:** Check Ettus Research support forums

---

**Last Updated:** December 24, 2025  
**Version:** 1.0.0
