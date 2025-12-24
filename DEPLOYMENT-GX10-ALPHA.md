# Deployment Guide: gx10-alpha ARM64

Complete guide for deploying the Ettus B210 SDR Web Application on gx10-alpha bare metal ARM64 Linux system.

---

## System Requirements

**Hardware:**
- Ettus B210 USRP with GPSDO (GPSTCXO v3.2)
- USB 3.0 connection
- ARM64 Linux system (gx10-alpha)

**Software Dependencies:**
- UHD (USRP Hardware Driver) 4.0+
- FFTW3 library
- CMake 3.10+
- GCC/G++ with C++17 support
- Node.js 22.x
- pnpm package manager

---

## Step 1: Install System Dependencies

```bash
# Update package lists
sudo apt update

# Install UHD and FFTW3
sudo apt install -y libuhd-dev uhd-host fftw3-dev

# Install build tools
sudo apt install -y cmake g++ pkg-config

# NOTE: Pre-compiled UHD tools are included in hardware/bin/
# If system UHD tools are not available, use the bundled versions:
# ./hardware/bin/uhd_find_devices

# Expected output:
# [INFO] [UHD] linux; GNU C++ version 11.4.0; Boost_107400; UHD_4.x.x.x
# --------------------------------------------------
# -- UHD Device 0
# --------------------------------------------------
# Device Address:
#     serial: 194919
#     name: B210
#     product: B210
#     type: b200
```

---

## Step 2: Verify B210 Hardware

**Option A: Use automated verification script (recommended)**

```bash
# Navigate to project directory
cd /path/to/ettus-sdr-web

# Run hardware verification script
./hardware/verify_b210.sh

# This script will:
# - Check UHD configuration
# - Detect USRP devices
# - Probe B210 details
# - Check GPSDO status (if installed)
```

**Option B: Manual verification**

```bash
# Check B210 connection (use bundled tool if system uhd not available)
./hardware/bin/uhd_usrp_probe --args="type=b200"

# Or use system UHD if installed:
uhd_usrp_probe

# Verify GPSDO detection
# Look for:
#   Clock Source: gpsdo
#   Time Source: gpsdo
#   GPS Locked: true

# Test GPS lock status
watch -n 1 './hardware/bin/uhd_usrp_probe --args="type=b200" | grep -A 5 "GPS"'

# Wait for GPS lock (can take 5-15 minutes on first boot)
# GPS Locked should show "true"
```

---

## Step 3: Build C++ Hardware Daemons

```bash
# Navigate to hardware directory
cd /path/to/ettus-sdr-web/hardware

# Create build directory
mkdir -p build
cd build

# Configure with CMake
cmake ..

# Build all binaries
make -j$(nproc)

# Verify binaries
ls -lh sdr_streamer iq_recorder freq_scanner

# Test sdr_streamer
./sdr_streamer --help
```

**Expected Build Output:**
```
[ 33%] Building CXX object CMakeFiles/sdr_streamer.dir/src/sdr_streamer.cpp.o
[ 66%] Linking CXX executable sdr_streamer
[ 66%] Built target sdr_streamer
[100%] Building CXX object CMakeFiles/iq_recorder.dir/src/iq_recorder.cpp.o
[100%] Linking CXX executable iq_recorder
[100%] Built target iq_recorder
```

---

## Step 4: Install Node.js Application

```bash
# Navigate to project root
cd /path/to/ettus-sdr-web

# Install dependencies
pnpm install

# Build frontend
pnpm build

# Set environment variables
export DATABASE_URL="mysql://user:pass@host/db"
export SDR_STREAMER_PATH="/path/to/ettus-sdr-web/hardware/build/sdr_streamer"

# Start production server
pnpm start
```

---

## Step 5: Configure Systemd Service

Create `/etc/systemd/system/sdr-web.service`:

```ini
[Unit]
Description=Ettus B210 SDR Web Application
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ettus-sdr-web
Environment="NODE_ENV=production"
Environment="DATABASE_URL=mysql://user:pass@host/db"
Environment="SDR_STREAMER_PATH=/home/ubuntu/ettus-sdr-web/hardware/build/sdr_streamer"
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sdr-web
sudo systemctl start sdr-web
sudo systemctl status sdr-web
```

---

## Step 6: Verify Deployment

```bash
# Check application logs
sudo journalctl -u sdr-web -f

# Test WebSocket connection
wscat -c ws://localhost:3000/ws/fft

# Test tRPC endpoints
curl http://localhost:3000/api/trpc/device.getStatus

# Verify B210 streaming
# Look for JSON FFT output in logs
```

---

## Troubleshooting

### B210 Not Detected

```bash
# Check USB connection
lsusb | grep Ettus

# Expected: Bus 001 Device 003: ID 2500:0020 Ettus Research LLC USRP B210

# Check UHD permissions
sudo usermod -a -G usrp $USER
# Logout and login again

# Reset B210
sudo uhd_usrp_probe --args="master_clock_rate=30.72e6"
```

### GPS Not Locking

```bash
# Check GPS antenna connection
# Ensure clear sky view
# Wait 15-30 minutes for cold start

# Monitor GPS status
watch -n 5 'uhd_usrp_probe | grep -A 10 "Sensors"'
```

### Build Errors

```bash
# Missing UHD headers
sudo apt install libuhd-dev

# Missing FFTW3
sudo apt install fftw3-dev

# CMake version too old
sudo apt install cmake

# Verify versions
uhd_find_devices --version
cmake --version
g++ --version
```

### Runtime Errors

```bash
# Check sdr_streamer output
./hardware/build/sdr_streamer 2>&1 | head -50

# Verify JSON output format
./hardware/build/sdr_streamer | jq .

# Test with lower sample rate
./hardware/build/sdr_streamer --rate 1e6
```

---

## Performance Tuning

### USB 3.0 Optimization

```bash
# Increase USB buffer size
echo 1000 | sudo tee /sys/module/usbcore/parameters/usbfs_memory_mb

# Make permanent in /etc/rc.local
```

### CPU Affinity

```bash
# Pin sdr_streamer to specific cores
taskset -c 0,1 ./sdr_streamer
```

### Real-time Priority

```bash
# Add user to realtime group
sudo usermod -a -G realtime $USER

# Set limits in /etc/security/limits.conf
@realtime   -  rtprio     99
@realtime   -  memlock    unlimited
```

---

## Monitoring

### Check Hardware Status

```bash
# B210 temperature
uhd_usrp_probe | grep -i temp

# USB bandwidth
sudo iotop -o

# FFT rate
sudo journalctl -u sdr-web | grep "FFT rate"
```

### Application Metrics

```bash
# WebSocket connections
netstat -an | grep :3000 | grep ESTABLISHED

# Memory usage
ps aux | grep node

# CPU usage
top -p $(pgrep -f "pnpm start")
```

---

## Next Steps

1. **Configure Nginx reverse proxy** for HTTPS and domain routing
2. **Set up log rotation** for application and C++ daemon logs
3. **Enable automatic updates** with systemd timers
4. **Add monitoring alerts** for GPS lock loss, USB disconnects, high temperature
5. **Backup database** with automated daily snapshots

---

## Support

For issues specific to:
- **UHD/B210**: https://files.ettus.com/manual/
- **GPSDO**: Check antenna connection and sky view
- **Application**: Check logs in `/var/log/sdr-web/`
