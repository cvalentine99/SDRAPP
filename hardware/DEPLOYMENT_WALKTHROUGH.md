# Ettus B210 SDR - Step-by-Step Deployment Walkthrough

**Target:** gx10-alpha ARM64 bare metal server  
**Estimated Time:** 40-60 minutes (mostly automated)  
**Difficulty:** Intermediate

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Ettus B210 USRP** hardware
- [ ] **USB 3.0 cable** (comes with B210)
- [ ] **SSH access** to gx10-alpha (username/password or SSH key)
- [ ] **Sudo privileges** on gx10-alpha
- [ ] **This project downloaded** on your local machine
- [ ] **Terminal/command line** access on your local machine

---

## Part 1: Pre-Deployment Preparation (5 minutes)

### Step 1.1: Test Deployment Package Locally

On your local machine, navigate to the project and run the test script:

```bash
cd ettus-sdr-web/hardware/
./test_deployment.sh
```

**Expected output:**
```
==================================
✅ Deployment Test Complete!
==================================

All tests passed!
```

**If test fails:**
- Check that all files are present
- Verify scripts have execute permissions
- See TROUBLESHOOTING.md for solutions

### Step 1.2: Test SSH Connection to gx10-alpha

Test your SSH connection:

```bash
ssh ubuntu@gx10-alpha

# If successful, you'll see:
# ubuntu@gx10-alpha:~$

# Type 'exit' to return to your local machine
exit
```

**If SSH fails:**
- Verify server hostname/IP is correct
- Check SSH port (default: 22)
- Ensure firewall allows SSH connections
- Try with explicit port: `ssh -p 22 ubuntu@gx10-alpha`

### Step 1.3: (Optional) Set Up SSH Key Authentication

If you're using password authentication, consider setting up SSH keys for easier deployment:

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key to gx10-alpha
ssh-copy-id ubuntu@gx10-alpha

# Test key-based login
ssh ubuntu@gx10-alpha
```

---

## Part 2: Automated Deployment (10-15 minutes)

### Step 2.1: Run Deployment Script

From your local machine:

```bash
cd ettus-sdr-web/hardware/
./deploy_to_gx10.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware
```

**What this does:**
1. Creates tarball of hardware directory (excludes build artifacts)
2. Tests SSH connection
3. Transfers tarball via SCP
4. Extracts files on gx10-alpha
5. Sets execute permissions
6. Verifies installation

**Expected output:**
```
==================================
Ettus B210 SDR - Automated Deployment
Target: gx10-alpha ARM64 server
==================================

Configuration:
  Remote User: ubuntu
  Remote Host: gx10-alpha
  Remote Port: 22
  Remote Directory: ~/ettus-sdr-hardware

Step 1: Testing SSH connection...
✅ SSH connection successful (using SSH key)

Step 2: Creating tarball of hardware directory...
✅ Tarball created: /tmp/hardware-deployment-20251224-153045.tar.gz (14K)

Step 3: Transferring tarball to gx10-alpha...
  Destination: ubuntu@gx10-alpha:~/ettus-sdr-hardware/
hardware-deployment-20251224-153045.tar.gz    100%   14KB   1.2MB/s   00:00
✅ Transfer successful

Step 4: Extracting tarball on remote server...
Creating directory: ~/ettus-sdr-hardware
Extracting tarball...
Cleaning up tarball...
Setting permissions...
✅ Extraction complete
✅ Extraction successful

Step 5: Verifying remote installation...
Files in remote directory:
total 48K
-rw-rw-r-- 1 ubuntu ubuntu 3.2K Dec 24 15:30 CMakeLists.txt
-rwxrwxr-x 1 ubuntu ubuntu 2.1K Dec 24 15:30 deploy_to_gx10.sh
-rwxrwxr-x 1 ubuntu ubuntu 4.5K Dec 24 15:30 install_dependencies.sh
-rwxrwxr-x 1 ubuntu ubuntu 3.8K Dec 24 15:30 remote_compile.sh
drwxrwxr-x 2 ubuntu ubuntu 4.0K Dec 24 15:30 src
-rwxrwxr-x 1 ubuntu ubuntu 2.7K Dec 24 15:30 verify_build.sh

Checking for key files...
✅ install_dependencies.sh
✅ verify_build.sh
✅ CMakeLists.txt
✅ src/ directory

==================================
✅ Deployment Complete!
==================================
```

**If deployment fails:**
- Check error message for specific issue
- Verify SSH credentials
- Ensure sufficient disk space on gx10-alpha
- See TROUBLESHOOTING.md

---

## Part 3: Dependency Installation (10-30 minutes)

### Step 3.1: SSH into gx10-alpha

```bash
ssh ubuntu@gx10-alpha
```

### Step 3.2: Navigate to Hardware Directory

```bash
cd ~/ettus-sdr-hardware
ls -la
```

**Expected output:**
```
total 48
drwxrwxr-x  3 ubuntu ubuntu 4096 Dec 24 15:30 .
drwxr-xr-x 12 ubuntu ubuntu 4096 Dec 24 15:30 ..
-rw-rw-r--  1 ubuntu ubuntu 3245 Dec 24 15:30 CMakeLists.txt
-rwxrwxr-x  1 ubuntu ubuntu 2134 Dec 24 15:30 deploy_to_gx10.sh
-rwxrwxr-x  1 ubuntu ubuntu 4567 Dec 24 15:30 install_dependencies.sh
-rwxrwxr-x  1 ubuntu ubuntu 3891 Dec 24 15:30 remote_compile.sh
drwxrwxr-x  2 ubuntu ubuntu 4096 Dec 24 15:30 src
-rwxrwxr-x  1 ubuntu ubuntu 2789 Dec 24 15:30 verify_build.sh
```

### Step 3.3: Run Dependency Installer

```bash
./install_dependencies.sh
```

**This will take 10-30 minutes.** ☕ **Go grab a coffee!**

**What this installs:**
- Build tools (gcc, g++, cmake, git)
- Boost libraries (all components)
- libusb for USB communication
- FFTW3 for FFT computation
- JSON libraries (nlohmann-json)
- **UHD (USRP Hardware Driver) from source** ← This takes the longest

**Expected output (abbreviated):**
```
==================================
Ettus B210 SDR - Dependency Installer
Target: ARM64 Linux (gx10-alpha)
==================================

Running as non-root user. Will use sudo for system operations.

Step 1: Updating package lists...
Get:1 http://ports.ubuntu.com/ubuntu-ports jammy InRelease [270 kB]
...

Step 2: Installing build tools...
Reading package lists... Done
Building dependency tree... Done
...

Step 7: Installing UHD (USRP Hardware Driver) from source...
This may take 10-30 minutes on ARM64...
Cloning UHD repository (v4.6.0.0)...
Configuring UHD build...
Building UHD (this will take a while)...
[ 10%] Building CXX object lib/CMakeFiles/uhd.dir/...
[ 20%] Building CXX object lib/CMakeFiles/uhd.dir/...
...
[100%] Built target uhd
Installing UHD...
✅ UHD installed successfully

Step 8: Downloading UHD FPGA images...
...

Step 9: Configuring USB permissions for B210...
Reloading udev rules...

==================================
✅ Dependency Installation Complete!
==================================
```

**If installation fails:**
- Check internet connection
- Verify sufficient disk space (need 2 GB free)
- See TROUBLESHOOTING.md for specific errors

---

## Part 4: Hardware Connection & Verification (2 minutes)

### Step 4.1: Connect B210 to USB 3.0 Port

1. **Locate a USB 3.0 port** on gx10-alpha (usually blue colored)
2. **Connect B210** using the USB 3.0 cable
3. **Wait 5 seconds** for device enumeration

### Step 4.2: Verify Device Detection

```bash
uhd_find_devices
```

**Expected output:**
```
linux; GNU C++ version 11.4.0; Boost_107400; UHD_4.6.0.0-0-unknown

--------------------------------------------------
-- UHD Device 0
--------------------------------------------------
Device Address:
    serial: 194919
    name: MyB210
    product: B210
    type: b200
```

**If no device found:**
- Check USB cable is firmly connected
- Try different USB 3.0 port
- Check USB permissions: `ls -l /dev/bus/usb/`
- Unplug and replug B210
- See TROUBLESHOOTING.md

### Step 4.3: Probe Device Details

```bash
uhd_usrp_probe --args='type=b200'
```

**Expected output (abbreviated):**
```
linux; GNU C++ version 11.4.0; Boost_107400; UHD_4.6.0.0-0-unknown

_____________________________________________________
/
|       Device: B-Series Device
|     _____________________________________________________
|    /
|   |       Mboard: B210
|   |   serial: 194919
|   |   name: MyB210
|   |   product: B210
|   |   revision: 4
|   |   FW Version: 8.0
|   |   FPGA Version: 16.0
...
```

**Save this output!** You'll need it to verify the web application later.

---

## Part 5: Compilation (2-5 minutes)

### Option A: Remote Compilation (From Local Machine)

**Recommended if you want to stay on your local machine:**

```bash
# From your local machine
cd ettus-sdr-web/hardware/
./remote_compile.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware
```

This will:
1. Check dependencies on gx10-alpha
2. Run CMake configuration
3. Compile all three binaries
4. Verify build success

### Option B: Manual Compilation (On gx10-alpha)

**If you prefer hands-on control:**

```bash
# On gx10-alpha
cd ~/ettus-sdr-hardware
mkdir -p build && cd build
cmake ..
make -j$(nproc)
```

**Expected output:**
```
-- The C compiler identification is GNU 11.4.0
-- The CXX compiler identification is GNU 11.4.0
...
-- Found UHD: /usr/local/lib/libuhd.so
-- Found FFTW3: /usr/lib/aarch64-linux-gnu/libfftw3.so
-- Configuring done
-- Generating done
-- Build files have been written to: /home/ubuntu/ettus-sdr-hardware/build

Scanning dependencies of target sdr_streamer
[ 33%] Building CXX object CMakeFiles/sdr_streamer.dir/src/sdr_streamer.cpp.o
[ 66%] Linking CXX executable bin/sdr_streamer
[ 66%] Built target sdr_streamer

Scanning dependencies of target freq_scanner
[ 83%] Building CXX object CMakeFiles/freq_scanner.dir/src/freq_scanner.cpp.o
[100%] Linking CXX executable bin/freq_scanner
[100%] Built target freq_scanner

Scanning dependencies of target iq_recorder
[100%] Building CXX object CMakeFiles/iq_recorder.dir/src/iq_recorder.cpp.o
[100%] Linking CXX executable bin/iq_recorder
[100%] Built target iq_recorder
```

---

## Part 6: Build Verification (1 minute)

### Step 6.1: Run Verification Script

```bash
cd ~/ettus-sdr-hardware
./verify_build.sh
```

**Expected output:**
```
==================================
Ettus B210 SDR - Build Verification
Target: ARM64 Linux (gx10-alpha)
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
Checking sdr_streamer dependencies:
✅ All libraries found
   ✅ UHD library linked
   ✅ FFTW3 library linked
   ✅ Boost libraries linked

Step 5: Checking UHD device detection...
Running uhd_find_devices (this may take a few seconds)...
✅ Ettus B210 device detected!
    serial: 194919
    name: MyB210
    product: B210
    type: b200

==================================
Build Verification Summary
==================================
Errors:   0
Warnings: 0

✅ BUILD VERIFICATION PASSED

Binary locations:
  - sdr_streamer: /home/ubuntu/ettus-sdr-hardware/build/bin/sdr_streamer
  - freq_scanner: /home/ubuntu/ettus-sdr-hardware/build/bin/freq_scanner
  - iq_recorder:  /home/ubuntu/ettus-sdr-hardware/build/bin/iq_recorder
```

---

## Part 7: Test Hardware Integration (2 minutes)

### Step 7.1: Test Real-Time FFT Streaming

```bash
cd ~/ettus-sdr-hardware/build/bin
./sdr_streamer --freq 915e6 --rate 10e6 --gain 40
```

**Expected output:** JSON objects streaming at ~60 FPS

```json
{"timestamp":1703462400123,"centerFreq":915000000.0,"sampleRate":10000000.0,"fftSize":2048,"fftData":[-80.5,-78.2,-79.1,...]}
{"timestamp":1703462400139,"centerFreq":915000000.0,"sampleRate":10000000.0,"fftSize":2048,"fftData":[-79.8,-77.5,-78.9,...]}
{"timestamp":1703462400156,"centerFreq":915000000.0,"sampleRate":10000000.0,"fftSize":2048,"fftData":[-80.1,-78.7,-79.4,...]}
...
```

**Press Ctrl+C to stop.**

**If you see JSON streaming:** ✅ **Hardware integration is working!**

**If errors occur:**
- Check B210 is connected
- Verify USB 3.0 connection
- See TROUBLESHOOTING.md

### Step 7.2: Test Frequency Scanner

```bash
./freq_scanner --start 900e6 --stop 930e6 --step 1e6 --gain 40
```

**Expected output:** JSON array with power measurements

```json
[
  {"frequency":900000000.0,"peakPower":-75.3},
  {"frequency":901000000.0,"peakPower":-78.1},
  {"frequency":902000000.0,"peakPower":-76.8},
  ...
  {"frequency":930000000.0,"peakPower":-77.2}
]
```

### Step 7.3: Test IQ Recorder

```bash
./iq_recorder --freq 915e6 --rate 10e6 --gain 40 --duration 2 --output /tmp/test.sigmf-data
```

**Expected output:**
```
Recording IQ samples...
Progress: 20%
Progress: 40%
Progress: 60%
Progress: 80%
Progress: 100%
Recording complete: 20000000 samples written to /tmp/test.sigmf-data
```

---

## Part 8: System-Wide Installation (1 minute)

### Step 8.1: Install Binaries to /usr/local/bin

```bash
cd ~/ettus-sdr-hardware/build
sudo cp bin/sdr_streamer /usr/local/bin/
sudo cp bin/freq_scanner /usr/local/bin/
sudo cp bin/iq_recorder /usr/local/bin/
sudo chmod +x /usr/local/bin/sdr_streamer
sudo chmod +x /usr/local/bin/freq_scanner
sudo chmod +x /usr/local/bin/iq_recorder
```

### Step 8.2: Verify System-Wide Access

```bash
which sdr_streamer
# Expected: /usr/local/bin/sdr_streamer

sdr_streamer --help
# Should show usage information
```

---

## Part 9: Web Application Configuration (2 minutes)

### Step 9.1: Navigate to Web Application Directory

```bash
cd /path/to/ettus-sdr-web
```

*(Replace `/path/to/` with actual path where web app is deployed)*

### Step 9.2: Update Environment Variables

```bash
nano .env
```

Add or update these lines:

```bash
# Set production mode
SDR_MODE=production

# Binary paths (optional if installed system-wide)
SDR_STREAMER_PATH=/usr/local/bin/sdr_streamer
FREQ_SCANNER_PATH=/usr/local/bin/freq_scanner
IQ_RECORDER_PATH=/usr/local/bin/iq_recorder
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

### Step 9.3: Restart Web Application

```bash
# If using systemd
sudo systemctl restart ettus-sdr-web

# Or if running manually
pnpm run build
NODE_ENV=production node server/_core/index.js
```

---

## Part 10: Final Verification (5 minutes)

### Step 10.1: Open Web Application

Open browser and navigate to: `https://your-domain.com`

### Step 10.2: Check SDR Mode

1. Navigate to **Settings** page
2. Verify "SDR Mode" shows **"Production"**
3. Device info should show real B210 data

### Step 10.3: Test Real-Time FFT Streaming

1. Navigate to **Spectrum** page
2. Click **START** button
3. You should see:
   - Real-time waterfall scrolling
   - Live FFT data from B210
   - Connection status: **CONNECTED** (green)
   - FPS counter showing ~60 FPS

### Step 10.4: Test Device Info

1. Navigate to **Device** page
2. Verify device info matches `uhd_usrp_probe` output:
   - Serial number
   - Firmware version
   - FPGA version
   - GPSDO status

### Step 10.5: Test Frequency Scanner

1. Navigate to **Scanner** page
2. Set frequency range (e.g., 900-930 MHz)
3. Click **START SCAN**
4. Verify scan results appear in chart and table

---

## Congratulations! 🎉

Your Ettus B210 SDR is now fully integrated with the web application!

**What you've accomplished:**
- ✅ Deployed hardware daemons to gx10-alpha
- ✅ Installed all dependencies (UHD, FFTW3, Boost)
- ✅ Compiled C++ binaries for ARM64
- ✅ Verified B210 hardware connection
- ✅ Tested real-time FFT streaming
- ✅ Configured web application for production mode
- ✅ Verified end-to-end integration

**Next steps:**
- Explore frequency scanning features
- Record IQ samples for offline analysis
- Tune to different frequencies and observe signals
- Adjust gain settings for optimal reception

---

## Quick Reference

**Binary locations:**
- `/usr/local/bin/sdr_streamer` - Real-time FFT streaming
- `/usr/local/bin/freq_scanner` - Frequency range scanning
- `/usr/local/bin/iq_recorder` - IQ sample recording

**Useful commands:**
```bash
# Find B210 device
uhd_find_devices

# Probe device details
uhd_usrp_probe --args='type=b200'

# Test FFT streaming
sdr_streamer --freq 915e6 --rate 10e6 --gain 40

# Scan frequency range
freq_scanner --start 900e6 --stop 930e6 --step 1e6 --gain 40

# Record IQ samples
iq_recorder --freq 915e6 --rate 10e6 --gain 40 --duration 5 --output /tmp/recording.sigmf-data
```

**Troubleshooting:**
- See `TROUBLESHOOTING.md` for common issues
- Check server logs: `journalctl -u ettus-sdr-web -f`
- Verify B210 connection: `lsusb | grep 2500`

---

**Need help?** See the comprehensive guides:
- `QUICKSTART.md` - Quick start guide
- `DEPLOYMENT_GUIDE.md` - Detailed deployment guide
- `TROUBLESHOOTING.md` - Common issues and solutions
- `VERIFICATION_CHECKLIST.md` - Post-deployment checklist
