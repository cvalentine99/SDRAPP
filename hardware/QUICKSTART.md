# Ettus B210 SDR - Quick Start Guide for gx10-alpha

**Target:** ARM64 bare metal server (gx10-alpha)  
**Time Required:** ~30 minutes (mostly automated)

---

## Prerequisites

- ✅ Ettus B210 USRP hardware
- ✅ USB 3.0 cable (blue port on server)
- ✅ SSH access to gx10-alpha
- ✅ Sudo privileges on gx10-alpha

---

## Step-by-Step Instructions

### 1. Transfer Hardware Package

From your local machine:

```bash
# Option A: Direct SCP transfer
scp hardware-deployment-gx10-alpha.tar.gz user@gx10-alpha:~/

# Option B: Upload to cloud and download on server
# (if direct SCP is blocked by firewall)
```

### 2. SSH into gx10-alpha

```bash
ssh user@gx10-alpha
```

### 3. Extract Package

```bash
cd ~
tar -xzf hardware-deployment-gx10-alpha.tar.gz
cd hardware/
```

### 4. Install Dependencies (10-30 minutes)

```bash
chmod +x install_dependencies.sh
./install_dependencies.sh
```

**What this does:**
- Installs build tools (gcc, g++, cmake)
- Installs UHD (USRP Hardware Driver) from source
- Installs FFTW3 (FFT library)
- Installs Boost and other dependencies
- Downloads B210 FPGA images
- Configures USB permissions

**Coffee break:** This step takes 10-30 minutes. Go grab a coffee! ☕

### 5. Connect B210 Hardware

While dependencies are installing:

1. Connect B210 to **USB 3.0 port** (blue port) on gx10-alpha
2. Wait for installation to complete
3. Verify device is detected:

```bash
uhd_find_devices
```

**Expected output:**

```
--------------------------------------------------
-- UHD Device 0
--------------------------------------------------
Device Address:
    serial: 194919
    name: MyB210
    product: B210
    type: b200
```

### 6. Compile C++ Daemons (2-5 minutes)

```bash
mkdir -p build && cd build
cmake ..
make -j$(nproc)
```

**Expected output:**

```
[100%] Built target sdr_streamer
[100%] Built target freq_scanner
[100%] Built target iq_recorder
```

### 7. Verify Build

```bash
cd ..
./verify_build.sh
```

**Expected output:**

```
✅ BUILD VERIFICATION PASSED

All binaries compiled successfully and are ready to use!

Binary locations:
  - sdr_streamer: /home/user/hardware/build/bin/sdr_streamer
  - freq_scanner: /home/user/hardware/build/bin/freq_scanner
  - iq_recorder:  /home/user/hardware/build/bin/iq_recorder
```

### 8. Test Real-Time FFT Streaming

```bash
cd build/bin
./sdr_streamer --freq 915e6 --rate 10e6 --gain 40
```

**Expected output:** JSON objects streaming at ~60 FPS

```json
{"timestamp":1703462400123,"centerFreq":915000000.0,"sampleRate":10000000.0,"fftSize":2048,"fftData":[-80.5,-78.2,...]}
{"timestamp":1703462400139,"centerFreq":915000000.0,"sampleRate":10000000.0,"fftSize":2048,"fftData":[-79.8,-77.5,...]}
...
```

Press **Ctrl+C** to stop.

### 9. Install Binaries System-Wide

```bash
sudo cp build/bin/sdr_streamer /usr/local/bin/
sudo cp build/bin/freq_scanner /usr/local/bin/
sudo cp build/bin/iq_recorder /usr/local/bin/
sudo chmod +x /usr/local/bin/sdr_streamer
sudo chmod +x /usr/local/bin/freq_scanner
sudo chmod +x /usr/local/bin/iq_recorder
```

### 10. Configure Web Application

```bash
cd /path/to/ettus-sdr-web

# Set production mode
echo "SDR_MODE=production" >> .env

# Restart web application
sudo systemctl restart ettus-sdr-web
# OR if running manually:
# pnpm run build && NODE_ENV=production node server/_core/index.js
```

### 11. Test in Browser

1. Open web application: `https://your-domain.com`
2. Navigate to **Settings** page
3. Verify "SDR Mode" shows **"Production"**
4. Navigate to **Spectrum** page
5. Click **START** button
6. You should see real-time FFT waterfall from B210! 🎉

---

## Troubleshooting

### Problem: "No devices found"

```bash
# Check USB connection
lsusb | grep 2500

# If not found, try different USB port (blue = USB 3.0)
# Unplug and replug B210

# Check USB permissions
ls -l /dev/bus/usb/

# If permission denied, run:
sudo ./install_dependencies.sh  # Re-run to fix udev rules
```

### Problem: "Buffer overflow" errors

```bash
# Reduce sample rate
./sdr_streamer --freq 915e6 --rate 5e6 --gain 40  # Try 5 MSPS
```

### Problem: Low frame rate (< 30 FPS)

```bash
# Reduce FFT size
./sdr_streamer --freq 915e6 --rate 10e6 --gain 40 --fft-size 1024

# Enable performance CPU governor
sudo cpufreq-set -g performance
```

### Problem: "Command not found" in web application

```bash
# Check binaries are in PATH
which sdr_streamer

# If not found, add to .env:
echo "SDR_STREAMER_PATH=/usr/local/bin/sdr_streamer" >> /path/to/ettus-sdr-web/.env
echo "FREQ_SCANNER_PATH=/usr/local/bin/freq_scanner" >> /path/to/ettus-sdr-web/.env
echo "IQ_RECORDER_PATH=/usr/local/bin/iq_recorder" >> /path/to/ettus-sdr-web/.env
```

---

## Next Steps

✅ **Hardware is ready!** Your Ettus B210 is now integrated with the web application.

**Try these features:**

1. **Spectrum Analyzer** - Real-time waterfall and spectrograph
2. **Frequency Scanner** - Scan 900-930 MHz for signals
3. **IQ Recorder** - Record raw IQ samples in SigMF format
4. **Device Controls** - Tune frequency, adjust gain, change sample rate
5. **Telemetry** - Monitor temperature, USB bandwidth, buffer health

---

## Performance Tips

- **Use USB 3.0 port** (blue) for best performance
- **Start with 10 MSPS** sample rate, increase if stable
- **Monitor CPU usage** with `htop` during streaming
- **Check USB bandwidth** in Telemetry page
- **Reduce FFT size** if frame rate drops below 30 FPS

---

## Files Included

- `install_dependencies.sh` - Automated dependency installer
- `verify_build.sh` - Build verification script
- `DEPLOYMENT_GUIDE.md` - Comprehensive deployment guide
- `BUILD_INSTRUCTIONS.md` - Detailed build instructions
- `src/sdr_streamer.cpp` - Real-time FFT streaming daemon
- `src/freq_scanner.cpp` - Frequency scanner daemon
- `src/iq_recorder.cpp` - IQ recorder daemon
- `CMakeLists.txt` - CMake build configuration
- `bin/` - Pre-compiled UHD tools (uhd_find_devices, uhd_usrp_probe, etc.)

---

## Support

- **Detailed guide:** See `DEPLOYMENT_GUIDE.md`
- **Build issues:** See `BUILD_INSTRUCTIONS.md`
- **UHD documentation:** https://files.ettus.com/manual/

---

**Happy SDR hacking!** 📡🎉
