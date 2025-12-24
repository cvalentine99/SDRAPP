# Ettus B210 SDR - Post-Deployment Verification Checklist

Use this checklist to verify your deployment is complete and working correctly.

**Date:** _______________  
**Technician:** _______________  
**Server:** gx10-alpha

---

## Phase 1: Hardware Verification

### 1.1 Physical Connection
- [ ] B210 connected to USB 3.0 port (blue port)
- [ ] USB cable is USB 3.0 certified (came with B210)
- [ ] B210 power LED is illuminated
- [ ] No physical damage to B210 or connectors

**Notes:** _______________________________________________

### 1.2 USB Detection
- [ ] Run: `lsusb | grep 2500`
- [ ] Output shows: `ID 2500:0020 Ettus Research LLC USRP B200`
- [ ] USB 3.0 connection verified: `lsusb -t` shows `5000M` not `480M`

**USB Bus/Device:** _______________

### 1.3 UHD Device Detection
- [ ] Run: `uhd_find_devices`
- [ ] Device found with correct serial number
- [ ] Device type shows: `type: b200`

**Serial Number:** _______________

### 1.4 Device Probe
- [ ] Run: `uhd_usrp_probe --args='type=b200'`
- [ ] Firmware version displayed: _______________
- [ ] FPGA version displayed: _______________
- [ ] GPSDO status: _______________
- [ ] No errors during probe

---

## Phase 2: Software Installation Verification

### 2.1 Dependencies
- [ ] UHD installed: `uhd_find_devices --version`
- [ ] UHD version: _______________
- [ ] FFTW3 installed: `pkg-config --modversion fftw3`
- [ ] FFTW3 version: _______________
- [ ] Boost installed: `dpkg -l | grep libboost`
- [ ] CMake installed: `cmake --version`
- [ ] CMake version: _______________

### 2.2 File Deployment
- [ ] Hardware directory exists: `ls ~/ettus-sdr-hardware`
- [ ] CMakeLists.txt present
- [ ] Source files present in `src/` directory
- [ ] Scripts are executable: `ls -l *.sh`

**Directory Size:** _______________ (should be ~20 KB before build)

### 2.3 Compilation
- [ ] Build directory exists: `ls ~/ettus-sdr-hardware/build`
- [ ] CMake configuration successful
- [ ] Compilation completed without errors
- [ ] All three binaries created:
  - [ ] `build/bin/sdr_streamer`
  - [ ] `build/bin/freq_scanner`
  - [ ] `build/bin/iq_recorder`

**Build Time:** _______________ minutes

---

## Phase 3: Binary Verification

### 3.1 Binary Integrity
- [ ] sdr_streamer size: _______________ (should be ~1-2 MB)
- [ ] freq_scanner size: _______________ (should be ~1-2 MB)
- [ ] iq_recorder size: _______________ (should be ~1-2 MB)
- [ ] All binaries are executable: `ls -l build/bin/`

### 3.2 Library Dependencies
- [ ] Run: `ldd build/bin/sdr_streamer`
- [ ] No "not found" entries
- [ ] UHD library linked: `libuhd.so`
- [ ] FFTW3 library linked: `libfftw3.so`
- [ ] Boost libraries linked

**Any missing libraries?** _______________

### 3.3 System-Wide Installation
- [ ] Binaries copied to `/usr/local/bin/`
- [ ] sdr_streamer accessible: `which sdr_streamer`
- [ ] freq_scanner accessible: `which freq_scanner`
- [ ] iq_recorder accessible: `which iq_recorder`
- [ ] All binaries have execute permissions

---

## Phase 4: Functional Testing

### 4.1 FFT Streaming Test
- [ ] Run: `sdr_streamer --freq 915e6 --rate 10e6 --gain 40`
- [ ] JSON output streaming at ~60 FPS
- [ ] No overflow (O) messages
- [ ] No underrun (U) messages
- [ ] Valid JSON format: test with `| head -1 | jq .`
- [ ] Ctrl+C stops cleanly

**FPS Observed:** _______________  
**Sample Rate:** _______________  
**Any Issues:** _______________

### 4.2 Frequency Scanner Test
- [ ] Run: `freq_scanner --start 900e6 --stop 930e6 --step 1e6 --gain 40`
- [ ] JSON array output
- [ ] All frequencies scanned (31 points)
- [ ] Power values in reasonable range (-100 to -40 dBm)
- [ ] No errors or warnings

**Scan Time:** _______________ seconds  
**Peak Power:** _______________ dBm at _______________ MHz

### 4.3 IQ Recorder Test
- [ ] Run: `iq_recorder --freq 915e6 --rate 10e6 --gain 40 --duration 2 --output /tmp/test.sigmf-data`
- [ ] Recording completes successfully
- [ ] File created: `ls -lh /tmp/test.sigmf-data`
- [ ] File size correct: _______________ (should be ~80 MB for 2 sec @ 10 MSPS)
- [ ] Metadata file created: `/tmp/test.sigmf-meta`

**Recording Duration:** _______________ seconds  
**File Size:** _______________

---

## Phase 5: Web Application Integration

### 5.1 Environment Configuration
- [ ] `.env` file updated with `SDR_MODE=production`
- [ ] Binary paths configured (if not using system-wide install)
- [ ] Web application restarted after configuration

**SDR_MODE:** _______________  
**SDR_STREAMER_PATH:** _______________

### 5.2 Device Info Verification
- [ ] Open web application in browser
- [ ] Navigate to Device page
- [ ] Device info displays correctly:
  - [ ] Serial number matches hardware: _______________
  - [ ] Firmware version matches: _______________
  - [ ] FPGA version matches: _______________
  - [ ] GPSDO status shows: _______________
- [ ] Footer status bar shows correct device info

### 5.3 Real-Time FFT Streaming
- [ ] Navigate to Spectrum page
- [ ] Click START button
- [ ] Connection status: CONNECTED (green)
- [ ] Waterfall scrolling smoothly
- [ ] FFT plot updating in real-time
- [ ] FPS counter shows: _______________ (should be ~60)
- [ ] No console errors
- [ ] Frequency tuning works
- [ ] Gain adjustment works
- [ ] Sample rate change works

**Observed FPS:** _______________  
**Latency:** _______________ ms

### 5.4 Frequency Scanner
- [ ] Navigate to Scanner page
- [ ] Set frequency range: 900-930 MHz
- [ ] Set step size: 1 MHz
- [ ] Set gain: 40 dB
- [ ] Click START SCAN
- [ ] Scan completes successfully
- [ ] Results displayed in chart
- [ ] Results displayed in table
- [ ] Peak detection works
- [ ] Export functionality works

**Scan Duration:** _______________ seconds  
**Peaks Detected:** _______________

### 5.5 IQ Recorder
- [ ] Navigate to Recordings page
- [ ] Set center frequency: 915 MHz
- [ ] Set sample rate: 10 MSPS
- [ ] Set duration: 5 seconds
- [ ] Click START RECORDING
- [ ] Recording progress shows
- [ ] Recording completes successfully
- [ ] File uploaded to S3
- [ ] Recording appears in list
- [ ] Download link works
- [ ] SigMF metadata correct

**Recording Size:** _______________  
**S3 URL:** _______________

---

## Phase 6: Performance Verification

### 6.1 CPU Usage
- [ ] Run: `top` while streaming
- [ ] sdr_streamer CPU usage: _______________ % (should be <50%)
- [ ] Web server CPU usage: _______________ % (should be <20%)
- [ ] Total system CPU usage: _______________ % (should be <70%)

### 6.2 Memory Usage
- [ ] Run: `free -h`
- [ ] Available memory: _______________ (should be >500 MB)
- [ ] No memory leaks after 10 minutes of streaming
- [ ] Swap usage: _______________ (should be minimal)

### 6.3 Network Performance
- [ ] Ping latency to gx10-alpha: _______________ ms (should be <10ms)
- [ ] WebSocket connection stable for 10+ minutes
- [ ] No dropped frames
- [ ] No connection timeouts

### 6.4 USB Performance
- [ ] No USB disconnects during 10-minute test
- [ ] No overflow messages
- [ ] USB bandwidth sufficient for max sample rate
- [ ] Run: `lsusb -t` confirms 5000M (USB 3.0)

---

## Phase 7: Stress Testing

### 7.1 Long-Duration Streaming
- [ ] Stream for 30 minutes continuously
- [ ] No crashes or errors
- [ ] Performance remains stable
- [ ] Memory usage stable (no leaks)

**Start Time:** _______________  
**End Time:** _______________  
**Issues:** _______________

### 7.2 Rapid Parameter Changes
- [ ] Rapidly change frequency 10 times
- [ ] Rapidly change gain 10 times
- [ ] Rapidly change sample rate 10 times
- [ ] No crashes or hangs
- [ ] All changes applied correctly

### 7.3 Multiple Scan Cycles
- [ ] Run 5 consecutive frequency scans
- [ ] All scans complete successfully
- [ ] Results consistent across scans
- [ ] No performance degradation

**Scan Times:** _______________, _______________, _______________, _______________, _______________

---

## Phase 8: Error Handling

### 8.1 USB Disconnect Recovery
- [ ] Start streaming
- [ ] Unplug B210 USB cable
- [ ] Web app shows disconnected status
- [ ] Plug B210 back in
- [ ] Click START to resume
- [ ] Streaming resumes successfully

**Recovery Time:** _______________ seconds

### 8.2 Process Restart
- [ ] Kill sdr_streamer process: `killall sdr_streamer`
- [ ] Web app detects disconnection
- [ ] Click START to restart
- [ ] Process spawns and connects
- [ ] Streaming resumes

### 8.3 Invalid Parameter Handling
- [ ] Try invalid frequency (e.g., 100 GHz)
- [ ] Error message displayed
- [ ] Try invalid gain (e.g., 200 dB)
- [ ] Error message displayed
- [ ] Try invalid sample rate (e.g., 1 THz)
- [ ] Error message displayed

---

## Phase 9: Security Verification

### 9.1 File Permissions
- [ ] Binaries not world-writable: `ls -l /usr/local/bin/sdr_*`
- [ ] Configuration files not world-readable
- [ ] S3 uploads use secure URLs
- [ ] No sensitive data in logs

### 9.2 Network Security
- [ ] Web app uses HTTPS (if in production)
- [ ] WebSocket uses WSS (if in production)
- [ ] No exposed credentials in environment variables
- [ ] Firewall rules configured correctly

---

## Phase 10: Documentation

### 10.1 Deployment Documentation
- [ ] QUICKSTART.md reviewed
- [ ] DEPLOYMENT_GUIDE.md reviewed
- [ ] DEPLOYMENT_WALKTHROUGH.md reviewed
- [ ] TROUBLESHOOTING.md reviewed
- [ ] VERIFICATION_CHECKLIST.md (this file) completed

### 10.2 Configuration Documentation
- [ ] Server hostname/IP documented: _______________
- [ ] SSH credentials documented (securely): _______________
- [ ] Binary paths documented: _______________
- [ ] Environment variables documented: _______________

### 10.3 Maintenance Documentation
- [ ] Backup procedure documented
- [ ] Update procedure documented
- [ ] Monitoring setup documented
- [ ] Contact information documented

---

## Final Sign-Off

### Deployment Summary

**Total Deployment Time:** _______________ minutes

**Issues Encountered:**
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Issues Resolved:**
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Outstanding Issues:**
1. _______________________________________________
2. _______________________________________________

### Verification Results

**Total Checks:** _____ / _____  
**Pass Rate:** _____ %

**Critical Failures:** _____  
**Warnings:** _____

### Deployment Status

- [ ] **PASSED** - All critical checks passed, ready for production
- [ ] **PASSED WITH WARNINGS** - Minor issues, acceptable for production
- [ ] **FAILED** - Critical issues, not ready for production

### Sign-Off

**Deployed By:** _______________  
**Date:** _______________  
**Signature:** _______________

**Verified By:** _______________  
**Date:** _______________  
**Signature:** _______________

---

## Next Steps

After successful verification:

1. **Production Deployment:**
   - [ ] Configure domain name
   - [ ] Set up SSL certificate
   - [ ] Configure firewall rules
   - [ ] Set up monitoring/alerting

2. **User Training:**
   - [ ] Train operators on web interface
   - [ ] Demonstrate frequency scanning
   - [ ] Show IQ recording workflow
   - [ ] Review troubleshooting procedures

3. **Monitoring Setup:**
   - [ ] Configure system monitoring (CPU, memory, disk)
   - [ ] Set up log aggregation
   - [ ] Configure alerting for errors
   - [ ] Set up performance dashboards

4. **Backup & Recovery:**
   - [ ] Configure automated backups
   - [ ] Test restore procedure
   - [ ] Document disaster recovery plan

5. **Maintenance Schedule:**
   - [ ] Weekly: Check logs for errors
   - [ ] Monthly: Review performance metrics
   - [ ] Quarterly: Update dependencies
   - [ ] Annually: Hardware inspection

---

## Appendix: Quick Reference

**Key Commands:**
```bash
# Find device
uhd_find_devices

# Probe device
uhd_usrp_probe --args='type=b200'

# Test streaming
sdr_streamer --freq 915e6 --rate 10e6 --gain 40

# Test scanner
freq_scanner --start 900e6 --stop 930e6 --step 1e6 --gain 40

# Test recorder
iq_recorder --freq 915e6 --rate 10e6 --gain 40 --duration 5 --output /tmp/test.sigmf-data

# Check processes
ps aux | grep sdr

# View logs
journalctl -u ettus-sdr-web -f

# Restart web app
sudo systemctl restart ettus-sdr-web
```

**Support Resources:**
- QUICKSTART.md - Quick start guide
- DEPLOYMENT_GUIDE.md - Comprehensive deployment guide
- TROUBLESHOOTING.md - Common issues and solutions
- Ettus Knowledge Base: https://kb.ettus.com/
- Ettus Forums: https://forums.ettus.com/

---

**Checklist Version:** 1.0  
**Last Updated:** December 24, 2025
