# Ettus B210 SDR - Troubleshooting Guide

This guide covers common issues encountered during deployment and operation of the Ettus B210 SDR web application.

---

## Table of Contents

1. [SSH Connection Issues](#ssh-connection-issues)
2. [Deployment Script Failures](#deployment-script-failures)
3. [Dependency Installation Problems](#dependency-installation-problems)
4. [B210 Device Not Detected](#b210-device-not-detected)
5. [Compilation Errors](#compilation-errors)
6. [Runtime Errors](#runtime-errors)
7. [Web Application Integration Issues](#web-application-integration-issues)
8. [Performance Problems](#performance-problems)
9. [USB Connection Issues](#usb-connection-issues)
10. [Advanced Diagnostics](#advanced-diagnostics)

---

## SSH Connection Issues

### Problem: "Connection refused" or "Connection timed out"

**Symptoms:**
```
ssh: connect to host gx10-alpha port 22: Connection refused
```

**Solutions:**

1. **Verify server is reachable:**
   ```bash
   ping gx10-alpha
   ```
   If ping fails, check network connectivity.

2. **Check SSH service is running:**
   ```bash
   # From another terminal with access to the server
   sudo systemctl status sshd
   ```

3. **Verify SSH port:**
   ```bash
   # Try different port if 22 is blocked
   ssh -p 2222 ubuntu@gx10-alpha
   ```

4. **Check firewall rules:**
   ```bash
   sudo ufw status
   # If SSH is blocked, allow it:
   sudo ufw allow 22/tcp
   ```

### Problem: "Permission denied (publickey)"

**Symptoms:**
```
ubuntu@gx10-alpha: Permission denied (publickey,password).
```

**Solutions:**

1. **Use password authentication:**
   ```bash
   ssh -o PreferredAuthentications=password ubuntu@gx10-alpha
   ```

2. **Copy SSH key:**
   ```bash
   ssh-copy-id ubuntu@gx10-alpha
   ```

3. **Check SSH key permissions:**
   ```bash
   chmod 600 ~/.ssh/id_rsa
   chmod 644 ~/.ssh/id_rsa.pub
   ```

### Problem: "Host key verification failed"

**Symptoms:**
```
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@    WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!     @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
```

**Solution:**
```bash
# Remove old host key
ssh-keygen -R gx10-alpha

# Or edit ~/.ssh/known_hosts and remove the line for gx10-alpha
```

---

## Deployment Script Failures

### Problem: "Tarball creation failed"

**Symptoms:**
```
❌ Tarball creation failed
tar: Exiting with failure status due to previous errors
```

**Solutions:**

1. **Check disk space:**
   ```bash
   df -h /tmp
   # Need at least 50 MB free
   ```

2. **Verify hardware directory exists:**
   ```bash
   ls -la hardware/
   ```

3. **Check file permissions:**
   ```bash
   chmod -R u+r hardware/
   ```

### Problem: "SCP transfer failed"

**Symptoms:**
```
❌ Transfer failed
scp: Connection closed
```

**Solutions:**

1. **Check network connectivity:**
   ```bash
   ping -c 4 gx10-alpha
   ```

2. **Verify remote disk space:**
   ```bash
   ssh ubuntu@gx10-alpha 'df -h ~'
   ```

3. **Try with verbose output:**
   ```bash
   scp -v -P 22 hardware-deployment.tar.gz ubuntu@gx10-alpha:/tmp/
   ```

### Problem: "Remote extraction failed"

**Symptoms:**
```
❌ Extraction failed
tar: Error is not recoverable: exiting now
```

**Solutions:**

1. **Check tarball integrity:**
   ```bash
   tar -tzf hardware-deployment.tar.gz | head
   ```

2. **Verify remote directory permissions:**
   ```bash
   ssh ubuntu@gx10-alpha 'ls -ld ~/ettus-sdr-hardware'
   ```

3. **Manual extraction:**
   ```bash
   ssh ubuntu@gx10-alpha
   cd ~/ettus-sdr-hardware
   tar -xzf /tmp/hardware-deployment-*.tar.gz --strip-components=1
   ```

---

## Dependency Installation Problems

### Problem: "Package not found" errors

**Symptoms:**
```
E: Unable to locate package libuhd-dev
E: Package 'libfftw3-dev' has no installation candidate
```

**Solutions:**

1. **Update package lists:**
   ```bash
   sudo apt-get update
   ```

2. **Enable universe repository:**
   ```bash
   sudo add-apt-repository universe
   sudo apt-get update
   ```

3. **Check Ubuntu version:**
   ```bash
   lsb_release -a
   # UHD requires Ubuntu 20.04+ or equivalent
   ```

### Problem: "Insufficient disk space"

**Symptoms:**
```
No space left on device
dpkg: error processing archive
```

**Solutions:**

1. **Check available space:**
   ```bash
   df -h
   # Need at least 2 GB free for UHD compilation
   ```

2. **Clean package cache:**
   ```bash
   sudo apt-get clean
   sudo apt-get autoclean
   ```

3. **Remove old kernels:**
   ```bash
   sudo apt-get autoremove
   ```

### Problem: "UHD compilation fails"

**Symptoms:**
```
CMake Error: Could not find Boost
fatal error: Python.h: No such file or directory
```

**Solutions:**

1. **Install missing Boost components:**
   ```bash
   sudo apt-get install libboost-all-dev
   ```

2. **Install Python development headers:**
   ```bash
   sudo apt-get install python3-dev
   ```

3. **Check CMake version:**
   ```bash
   cmake --version
   # Need CMake 3.10+
   ```

4. **Retry UHD installation:**
   ```bash
   cd ~/ettus-sdr-hardware
   ./install_dependencies.sh
   ```

### Problem: "Permission denied during installation"

**Symptoms:**
```
E: Could not open lock file /var/lib/dpkg/lock-frontend
```

**Solutions:**

1. **Check if another apt process is running:**
   ```bash
   ps aux | grep apt
   # Kill if stuck: sudo killall apt apt-get
   ```

2. **Remove lock files:**
   ```bash
   sudo rm /var/lib/dpkg/lock-frontend
   sudo rm /var/lib/dpkg/lock
   sudo dpkg --configure -a
   ```

---

## B210 Device Not Detected

### Problem: "No UHD devices found"

**Symptoms:**
```
$ uhd_find_devices
No UHD Devices Found
```

**Solutions:**

1. **Check USB connection:**
   ```bash
   lsusb | grep 2500
   # Should show: Bus 001 Device 003: ID 2500:0020 Ettus Research LLC USRP B200
   ```

2. **Verify USB 3.0 connection:**
   ```bash
   lsusb -t
   # Look for "5000M" (USB 3.0) not "480M" (USB 2.0)
   ```

3. **Check USB permissions:**
   ```bash
   ls -l /dev/bus/usb/001/003
   # Should be readable by your user or group 'usrp'
   ```

4. **Reload udev rules:**
   ```bash
   sudo udevadm control --reload-rules
   sudo udevadm trigger
   ```

5. **Unplug and replug B210:**
   ```bash
   # Unplug B210, wait 5 seconds, plug back in
   dmesg | tail -20
   # Should show USB device enumeration
   ```

### Problem: "USB 2.0 fallback" warning

**Symptoms:**
```
[WARNING] [B200] Detected USB 2.0 connection; performance may be limited
```

**Solutions:**

1. **Use blue USB 3.0 port:**
   - Blue ports = USB 3.0
   - Black ports = USB 2.0

2. **Check USB 3.0 cable:**
   - Ensure using cable that came with B210
   - Some cables are USB 2.0 only

3. **Verify USB 3.0 controller:**
   ```bash
   lspci | grep -i usb
   # Should show xHCI controller
   ```

### Problem: "Device busy" or "Resource temporarily unavailable"

**Symptoms:**
```
RuntimeError: Device is in use by another process
```

**Solutions:**

1. **Check for running processes:**
   ```bash
   ps aux | grep sdr_streamer
   ps aux | grep uhd
   ```

2. **Kill stuck processes:**
   ```bash
   killall sdr_streamer freq_scanner iq_recorder
   ```

3. **Reset USB device:**
   ```bash
   # Find USB bus and device number
   lsusb | grep 2500
   # Bus 001 Device 003: ID 2500:0020
   
   # Reset device
   sudo usbreset /dev/bus/usb/001/003
   ```

---

## Compilation Errors

### Problem: "CMake configuration failed"

**Symptoms:**
```
CMake Error: Could not find UHD
CMake Error: Could not find FFTW3
```

**Solutions:**

1. **Verify UHD installation:**
   ```bash
   pkg-config --modversion uhd
   # Should show version number
   ```

2. **Check library paths:**
   ```bash
   ldconfig -p | grep uhd
   ldconfig -p | grep fftw3
   ```

3. **Set PKG_CONFIG_PATH:**
   ```bash
   export PKG_CONFIG_PATH=/usr/local/lib/pkgconfig:$PKG_CONFIG_PATH
   cmake ..
   ```

### Problem: "Compiler errors during make"

**Symptoms:**
```
error: 'class uhd::usrp::multi_usrp' has no member named 'get_rx_stream'
fatal error: uhd/usrp/multi_usrp.hpp: No such file or directory
```

**Solutions:**

1. **Check UHD headers:**
   ```bash
   ls /usr/local/include/uhd/usrp/
   ```

2. **Reinstall UHD:**
   ```bash
   cd ~/ettus-sdr-hardware
   ./install_dependencies.sh
   ```

3. **Clean and rebuild:**
   ```bash
   cd ~/ettus-sdr-hardware
   rm -rf build
   mkdir build && cd build
   cmake ..
   make -j$(nproc)
   ```

### Problem: "Linking errors"

**Symptoms:**
```
undefined reference to `uhd::usrp::multi_usrp::make'
collect2: error: ld returned 1 exit status
```

**Solutions:**

1. **Update library cache:**
   ```bash
   sudo ldconfig
   ```

2. **Check library locations:**
   ```bash
   find /usr -name "libuhd.so*" 2>/dev/null
   ```

3. **Set LD_LIBRARY_PATH:**
   ```bash
   export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
   make
   ```

---

## Runtime Errors

### Problem: "sdr_streamer crashes immediately"

**Symptoms:**
```
$ ./sdr_streamer --freq 915e6 --rate 10e6 --gain 40
Segmentation fault (core dumped)
```

**Solutions:**

1. **Check library dependencies:**
   ```bash
   ldd build/bin/sdr_streamer
   # Look for "not found" entries
   ```

2. **Run with debugger:**
   ```bash
   gdb build/bin/sdr_streamer
   (gdb) run --freq 915e6 --rate 10e6 --gain 40
   (gdb) backtrace
   ```

3. **Check UHD device access:**
   ```bash
   uhd_usrp_probe --args='type=b200'
   # Should complete without errors
   ```

### Problem: "Overflow (O) messages"

**Symptoms:**
```
OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO
```

**Solutions:**

1. **Reduce sample rate:**
   ```bash
   ./sdr_streamer --freq 915e6 --rate 5e6 --gain 40
   ```

2. **Check USB 3.0 connection:**
   ```bash
   lsusb -t | grep -A 5 "2500"
   # Should show 5000M not 480M
   ```

3. **Increase buffer size:**
   ```bash
   # Edit sdr_streamer.cpp and increase recv_buff_size
   # Then recompile
   ```

### Problem: "Underrun (U) messages"

**Symptoms:**
```
UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU
```

**Solutions:**

1. **Reduce processing load:**
   ```bash
   # Lower FFT update rate
   # Reduce FFT size
   ```

2. **Check CPU usage:**
   ```bash
   top
   # sdr_streamer should use <50% CPU
   ```

### Problem: "JSON parsing errors in web app"

**Symptoms:**
```
[ERROR] Failed to parse FFT data: Unexpected token
```

**Solutions:**

1. **Test binary output:**
   ```bash
   ./sdr_streamer --freq 915e6 --rate 10e6 --gain 40 | head -1 | jq .
   # Should parse as valid JSON
   ```

2. **Check for extra output:**
   ```bash
   # Remove any debug printf() statements from C++ code
   # Recompile
   ```

---

## Web Application Integration Issues

### Problem: "Device info shows 'unknown' values"

**Symptoms:**
- Serial: unknown
- Firmware: unknown
- FPGA: unknown

**Solutions:**

1. **Check SDR_MODE environment variable:**
   ```bash
   echo $SDR_MODE
   # Should be "production" not "demo"
   ```

2. **Verify uhd_usrp_probe works:**
   ```bash
   uhd_usrp_probe --args='type=b200'
   # Should show device details
   ```

3. **Check web app logs:**
   ```bash
   journalctl -u ettus-sdr-web -f
   # Look for "Failed to probe device" errors
   ```

4. **Test probe from web app user:**
   ```bash
   sudo -u www-data uhd_usrp_probe --args='type=b200'
   # Should work without permission errors
   ```

### Problem: "FFT stream not connecting"

**Symptoms:**
- Connection status: DISCONNECTED (red)
- No waterfall data
- Console error: "WebSocket connection failed"

**Solutions:**

1. **Check sdr_streamer is running:**
   ```bash
   ps aux | grep sdr_streamer
   ```

2. **Verify WebSocket endpoint:**
   ```bash
   # Check server logs for WebSocket initialization
   journalctl -u ettus-sdr-web -f | grep WebSocket
   ```

3. **Test sdr_streamer manually:**
   ```bash
   /usr/local/bin/sdr_streamer --freq 915e6 --rate 10e6 --gain 40
   # Should output JSON
   ```

4. **Check binary path in .env:**
   ```bash
   cat .env | grep SDR_STREAMER_PATH
   # Should point to correct binary location
   ```

### Problem: "Scanner returns no results"

**Symptoms:**
- Scan completes but table is empty
- Console error: "Failed to parse scanner output"

**Solutions:**

1. **Test freq_scanner manually:**
   ```bash
   /usr/local/bin/freq_scanner --start 900e6 --stop 930e6 --step 1e6 --gain 40
   # Should output JSON array
   ```

2. **Check frequency range:**
   ```bash
   # B210 range: 50 MHz - 6 GHz
   # Ensure start/stop are within range
   ```

3. **Verify gain setting:**
   ```bash
   # B210 gain range: 0-76 dB
   # Try with gain=40
   ```

---

## Performance Problems

### Problem: "Low FPS (<30 FPS)"

**Symptoms:**
- FPS counter shows <30
- Waterfall updates slowly
- Laggy UI

**Solutions:**

1. **Check CPU usage:**
   ```bash
   top
   # Look for high CPU processes
   ```

2. **Reduce FFT size:**
   ```javascript
   // In sdr_streamer.cpp
   const size_t fft_size = 1024; // Instead of 2048
   ```

3. **Lower sample rate:**
   ```bash
   # Use 5 MHz instead of 10 MHz
   ```

4. **Check network latency:**
   ```bash
   ping gx10-alpha
   # Should be <10ms for local network
   ```

### Problem: "High CPU usage (>80%)"

**Symptoms:**
- sdr_streamer uses >80% CPU
- System becomes unresponsive

**Solutions:**

1. **Optimize FFT computation:**
   ```cpp
   // Use FFTW wisdom for faster FFTs
   fftw_import_wisdom_from_filename("/tmp/fftw_wisdom");
   ```

2. **Reduce update rate:**
   ```cpp
   // Add sleep between FFT computations
   std::this_thread::sleep_for(std::chrono::milliseconds(16));
   ```

3. **Use hardware acceleration:**
   ```bash
   # Check for ARM NEON support
   cat /proc/cpuinfo | grep neon
   ```

### Problem: "Memory leaks"

**Symptoms:**
- Memory usage grows over time
- System runs out of RAM
- OOM killer terminates processes

**Solutions:**

1. **Check for leaks with valgrind:**
   ```bash
   valgrind --leak-check=full ./sdr_streamer --freq 915e6 --rate 10e6 --gain 40
   ```

2. **Monitor memory usage:**
   ```bash
   watch -n 1 'ps aux | grep sdr_streamer'
   ```

3. **Restart daemons periodically:**
   ```bash
   # Add to crontab
   0 */6 * * * killall sdr_streamer && sleep 5 && /usr/local/bin/sdr_streamer ...
   ```

---

## USB Connection Issues

### Problem: "USB device keeps disconnecting"

**Symptoms:**
```
[ERROR] [B200] USB device disconnected
dmesg: usb 1-1: USB disconnect, device number 3
```

**Solutions:**

1. **Check USB cable:**
   - Try different USB 3.0 cable
   - Ensure cable is not damaged

2. **Disable USB autosuspend:**
   ```bash
   echo -1 | sudo tee /sys/module/usbcore/parameters/autosuspend
   ```

3. **Check power supply:**
   - B210 draws up to 2A from USB
   - Use powered USB hub if needed

4. **Update USB firmware:**
   ```bash
   sudo apt-get install linux-firmware
   sudo update-initramfs -u
   sudo reboot
   ```

### Problem: "USB bandwidth errors"

**Symptoms:**
```
[ERROR] [B200] USB bandwidth exceeded
```

**Solutions:**

1. **Reduce sample rate:**
   ```bash
   # Use 30.72 MSPS instead of 61.44 MSPS
   ```

2. **Check USB tree:**
   ```bash
   lsusb -t
   # Ensure B210 is on dedicated USB controller
   ```

3. **Disable other USB devices:**
   ```bash
   # Unplug unnecessary USB devices
   # Especially webcams, external drives
   ```

---

## Advanced Diagnostics

### Collect System Information

```bash
#!/bin/bash
# Save as collect_diagnostics.sh

echo "=== System Information ===" > diagnostics.txt
uname -a >> diagnostics.txt
lsb_release -a >> diagnostics.txt
echo "" >> diagnostics.txt

echo "=== USB Devices ===" >> diagnostics.txt
lsusb >> diagnostics.txt
lsusb -t >> diagnostics.txt
echo "" >> diagnostics.txt

echo "=== UHD Devices ===" >> diagnostics.txt
uhd_find_devices >> diagnostics.txt 2>&1
echo "" >> diagnostics.txt

echo "=== UHD Probe ===" >> diagnostics.txt
uhd_usrp_probe --args='type=b200' >> diagnostics.txt 2>&1
echo "" >> diagnostics.txt

echo "=== Library Versions ===" >> diagnostics.txt
pkg-config --modversion uhd >> diagnostics.txt 2>&1
pkg-config --modversion fftw3 >> diagnostics.txt 2>&1
echo "" >> diagnostics.txt

echo "=== Binary Dependencies ===" >> diagnostics.txt
ldd /usr/local/bin/sdr_streamer >> diagnostics.txt 2>&1
echo "" >> diagnostics.txt

echo "=== Recent Kernel Messages ===" >> diagnostics.txt
dmesg | tail -50 >> diagnostics.txt
echo "" >> diagnostics.txt

echo "Diagnostics saved to diagnostics.txt"
```

### Enable Debug Logging

**For UHD:**
```bash
export UHD_LOG_LEVEL=debug
uhd_usrp_probe --args='type=b200'
```

**For sdr_streamer:**
```cpp
// Add to sdr_streamer.cpp
#define DEBUG 1
#ifdef DEBUG
  std::cerr << "Debug: " << message << std::endl;
#endif
```

### Test with Loopback

```bash
# Connect TX to RX with SMA cable
# Run loopback test
uhd_test_loopback --args='type=b200' --freq 915e6 --rate 10e6
```

---

## Getting Help

If you've tried all solutions and still have issues:

1. **Collect diagnostics:**
   ```bash
   ./collect_diagnostics.sh
   ```

2. **Check UHD documentation:**
   - https://files.ettus.com/manual/

3. **Search Ettus Knowledge Base:**
   - https://kb.ettus.com/

4. **Post on Ettus forums:**
   - https://forums.ettus.com/

5. **Contact Ettus support:**
   - support@ettus.com

**Include in your support request:**
- diagnostics.txt output
- Exact error messages
- Steps to reproduce
- Hardware configuration
- Software versions

---

## Quick Reference: Common Commands

```bash
# Find B210
uhd_find_devices

# Probe device
uhd_usrp_probe --args='type=b200'

# Check USB connection
lsusb | grep 2500
lsusb -t

# Test FFT streaming
/usr/local/bin/sdr_streamer --freq 915e6 --rate 10e6 --gain 40

# Check running processes
ps aux | grep sdr

# View system logs
journalctl -u ettus-sdr-web -f

# Check library dependencies
ldd /usr/local/bin/sdr_streamer

# Reset USB device
sudo usbreset /dev/bus/usb/001/003

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```
