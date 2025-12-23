# Ettus B210 SDR Web Application - Project Completion Phases

## Executive Summary

This document outlines the remaining work to complete the Ettus B210 SDR Web Application and make it production-ready for deployment on gx10-alpha ARM64 hardware. The project is **~75% complete** with core architecture, design system, and backend integration finished. Remaining work focuses on frontend-backend wiring, real-time data streaming, and production deployment.

---

## Phase 1: Frontend-Backend Integration (HIGH PRIORITY)

**Goal**: Wire all frontend pages to backend tRPC procedures and WebSocket streams

**Status**: 🟡 In Progress (50% complete)

### Tasks

#### 1.1 Spectrum Page WebSocket Integration
- [ ] **Wire Spectrum.tsx to WebSocket FFT stream**
  - Import useWebSocket hook from client/src/hooks/
  - Subscribe to 'fft' channel on component mount
  - Update WaterfallDisplay with real FFT data from WebSocket
  - Add connection status indicator (connected/disconnected/reconnecting)
  - Handle reconnection on mode switch (demo ↔ production)
  
- [ ] **Add WebSocket reconnection logic**
  - Implement exponential backoff (1s, 2s, 4s, 8s, max 30s)
  - Show toast notification on disconnect
  - Auto-reconnect when server comes back online
  - Clear old data on reconnection

- [ ] **Optimize FFT data rendering**
  - Throttle updates to 60 FPS max (requestAnimationFrame)
  - Use double buffering for smooth waterfall scrolling
  - Add FPS counter to verify performance

**Estimated Time**: 4-6 hours

---

#### 1.2 Device Page Hardware Control Wiring
- [x] ~~Device.tsx already wired to device-router.ts~~ ✅ COMPLETE
- [ ] **Add real-time status updates**
  - Poll device.getStatus every 5 seconds
  - Display GPSDO lock status (green/red indicator)
  - Show GPS time and servo offset
  - Display RX/TX temperature sensors
  - Add LO lock and ref lock indicators

- [ ] **Add frequency tuning enhancements**
  - Implement velocity-aware dragging (faster drag = bigger steps)
  - Add frequency bookmark system (save/load presets)
  - Add keyboard shortcuts (arrow keys for ±1 MHz, Shift+arrow for ±10 MHz)

**Estimated Time**: 3-4 hours

---

#### 1.3 Recording Page Integration
- [ ] **Wire Recording.tsx to recording-router.ts**
  - Replace mock data with trpc.recording.list.useQuery()
  - Implement trpc.recording.start.useMutation() for START button
  - Implement trpc.recording.stop.useMutation() for STOP button
  - Implement trpc.recording.delete.useMutation() for delete action
  - Add trpc.recording.getStatus.useQuery() for active recording status

- [ ] **Add recording status polling**
  - Poll getStatus every 1 second during active recording
  - Update duration, file size, and frame count in real-time
  - Show progress bar for timed recordings

- [ ] **Add download functionality**
  - Generate download links for .sigmf-data and .sigmf-meta files
  - Add "Download All" button for batch downloads
  - Show file size and estimated download time

**Estimated Time**: 4-5 hours

---

#### 1.4 Telemetry Page Real Metrics
- [ ] **Wire Telemetry.tsx to telemetry-router.ts**
  - Replace hardcoded values with trpc.telemetry.getMetrics.useQuery()
  - Poll metrics every 2 seconds for real-time updates
  - Add trpc.telemetry.getHardwareStatus.useQuery() for hardware health

- [ ] **Add performance charts**
  - Create time-series charts for FFT rate, throughput, latency
  - Use Chart.js or Recharts for visualization
  - Show last 60 seconds of data (rolling window)

- [ ] **Add system health indicators**
  - CPU usage gauge (0-100%)
  - Memory usage gauge (0-100%)
  - GPU utilization (if available)
  - Network bandwidth (KB/s, MB/s)

**Estimated Time**: 3-4 hours

---

#### 1.5 AI Assistant Integration
- [ ] **Wire AIAssistant.tsx to ai-router.ts**
  - Replace mock chat with trpc.ai.chat.useMutation()
  - Implement streaming responses (if supported)
  - Add trpc.ai.analyzeSpectrum.useMutation() for spectrum analysis

- [ ] **Add spectrum context to AI queries**
  - Capture current FFT snapshot when user asks question
  - Send center frequency, sample rate, and peak power to AI
  - Display AI insights with spectrum annotations

- [ ] **Add conversation history**
  - Store chat messages in database (ai_conversations table)
  - Load previous conversations on page load
  - Add "Clear History" button

**Estimated Time**: 4-5 hours

---

## Phase 2: Hardware Deployment & Testing (HIGH PRIORITY)

**Goal**: Deploy to gx10-alpha ARM64 hardware and verify B210 integration

**Status**: 🔴 Not Started

### Tasks

#### 2.1 C++ Binary Compilation
- [ ] **Build sdr_streamer on gx10-alpha**
  ```bash
  cd /home/ubuntu/ettus-sdr-web/hardware/build
  cmake ..
  make
  sudo make install
  ```
  - Verify UHD library version (4.x required)
  - Check for compilation errors
  - Test binary: `./sdr_streamer --freq 915e6 --rate 10e6 --gain 50`

- [ ] **Build iq_recorder daemon**
  ```bash
  cd /home/ubuntu/ettus-sdr-web/hardware/build
  make iq_recorder
  ```
  - Test recording: `./iq_recorder --freq 915e6 --duration 10 --output test.sigmf`

- [ ] **Build freq_scanner utility**
  ```bash
  cd /home/ubuntu/ettus-sdr-web/hardware/build
  make freq_scanner
  ```
  - Test scanning: `./freq_scanner --start 900e6 --stop 930e6 --step 1e6`

**Estimated Time**: 2-3 hours

---

#### 2.2 B210 Hardware Verification
- [ ] **Verify B210 detection**
  ```bash
  uhd_find_devices
  # Should show: B210 (serial 194919, USB 3.0)
  ```

- [ ] **Verify GPSDO lock**
  ```bash
  uhd_usrp_probe --args="type=b200" --tree
  # Check: mboards/0/sensors/gps_locked = true
  ```

- [ ] **Test frequency tuning**
  - Tune to 50 MHz (minimum)
  - Tune to 6000 MHz (maximum)
  - Verify no errors in UHD logs

- [ ] **Test gain control**
  - Set RX gain to 0 dB (minimum)
  - Set RX gain to 76 dB (maximum)
  - Verify gain stages (LNA, TIA, PGA) respond correctly

- [ ] **Test sample rate**
  - Set sample rate to 200 kHz (minimum)
  - Set sample rate to 61.44 MSPS (maximum)
  - Verify no buffer overflows at high rates

**Estimated Time**: 2-3 hours

---

#### 2.3 Production Mode Testing
- [ ] **Switch to production mode**
  - Set SDR_MODE=production in .env
  - Restart server
  - Verify "PRODUCTION MODE" in footer status bar

- [ ] **Test real-time FFT streaming**
  - Navigate to Spectrum page
  - Verify waterfall displays real RF environment
  - Check for dropped frames (should be < 1%)
  - Verify frequency axis matches center frequency

- [ ] **Test hardware control**
  - Change frequency from Device page
  - Verify sdr_streamer restarts with new frequency
  - Change gain and verify FFT amplitude changes
  - Change sample rate and verify waterfall updates

- [ ] **Test GPSDO synchronization**
  - Wait for GPS lock (may take 5-10 minutes outdoors)
  - Verify "GPS LOCKED" indicator turns green
  - Check GPS time matches UTC
  - Verify servo offset < 100 ns

**Estimated Time**: 3-4 hours

---

## Phase 3: Performance Optimization (MEDIUM PRIORITY)

**Goal**: Ensure 60 FPS FFT display and low latency

**Status**: 🔴 Not Started

### Tasks

#### 3.1 WebGL Optimization
- [ ] **Profile WebGL rendering**
  - Use Chrome DevTools Performance tab
  - Identify bottlenecks (shader compilation, texture uploads, draw calls)
  - Target: < 16ms per frame (60 FPS)

- [ ] **Optimize waterfall shader**
  - Minimize texture lookups
  - Use texture atlases for color maps
  - Enable mipmapping for smooth zooming

- [ ] **Add GPU memory monitoring**
  - Track texture memory usage
  - Warn if approaching GPU memory limit
  - Implement texture pooling for reuse

**Estimated Time**: 4-5 hours

---

#### 3.2 WebSocket Optimization
- [ ] **Implement binary protocol**
  - Replace JSON with binary MessagePack or Protocol Buffers
  - Reduce FFT data size by 50-70%
  - Benchmark: JSON vs binary throughput

- [ ] **Add compression**
  - Enable WebSocket permessage-deflate extension
  - Compress FFT data before sending
  - Measure latency impact (should be < 5ms)

- [ ] **Implement backpressure handling**
  - Detect slow clients (buffer > 10 MB)
  - Drop frames for slow clients (keep latest)
  - Log dropped frame count

**Estimated Time**: 3-4 hours

---

#### 3.3 Database Optimization
- [ ] **Add indexes for common queries**
  ```sql
  CREATE INDEX idx_recordings_user_id ON recordings(user_id);
  CREATE INDEX idx_recordings_timestamp ON recordings(timestamp DESC);
  ```

- [ ] **Optimize recording list query**
  - Add pagination (limit 50 per page)
  - Add sorting options (date, size, duration)
  - Add filtering (frequency range, date range)

- [ ] **Add database connection pooling**
  - Configure max connections (default: 10)
  - Set connection timeout (default: 30s)
  - Monitor pool utilization

**Estimated Time**: 2-3 hours

---

## Phase 4: User Experience Enhancements (MEDIUM PRIORITY)

**Goal**: Improve usability and polish UI

**Status**: 🔴 Not Started

### Tasks

#### 4.1 Keyboard Shortcuts
- [ ] **Implement command palette (Cmd/Ctrl+K)**
  - Search all pages and actions
  - Jump to frequency (e.g., "915 MHz")
  - Quick actions (start recording, switch mode)

- [ ] **Add global shortcuts**
  - Space: Start/stop acquisition
  - R: Start/stop recording
  - F: Focus frequency input
  - G: Focus gain slider
  - Esc: Close modals/dialogs

- [ ] **Add frequency tuning shortcuts**
  - Arrow Up/Down: ±1 MHz
  - Shift+Arrow: ±10 MHz
  - Ctrl+Arrow: ±100 kHz
  - Page Up/Down: ±100 MHz

**Estimated Time**: 3-4 hours

---

#### 4.2 Loading States & Error Handling
- [ ] **Add loading skeletons**
  - Spectrum page: Waterfall skeleton while connecting
  - Device page: Control panel skeleton while loading config
  - Recording page: Table skeleton while loading list
  - Telemetry page: Chart skeletons while loading metrics

- [ ] **Add error boundaries**
  - Catch React errors and show fallback UI
  - Add "Report Bug" button with error details
  - Log errors to backend for debugging

- [ ] **Add retry mechanisms**
  - Auto-retry failed tRPC queries (max 3 attempts)
  - Show "Retry" button for manual retry
  - Exponential backoff for retries

**Estimated Time**: 3-4 hours

---

#### 4.3 Empty States
- [ ] **Add empty state for Recording page**
  - Show "No recordings yet" message
  - Add "Start Recording" CTA button
  - Show example screenshot of recording

- [ ] **Add empty state for AI Assistant**
  - Show suggested questions
  - Add "Analyze Current Spectrum" button
  - Show example conversation

- [ ] **Add empty state for Telemetry**
  - Show "Waiting for data..." message
  - Add "Start Acquisition" CTA button

**Estimated Time**: 2-3 hours

---

## Phase 5: Documentation & Deployment (LOW PRIORITY)

**Goal**: Create user documentation and deployment automation

**Status**: 🔴 Not Started

### Tasks

#### 5.1 User Documentation
- [ ] **Create USER_GUIDE.md**
  - Getting started tutorial
  - Spectrum analysis basics
  - Recording workflow
  - AI assistant usage
  - Keyboard shortcuts reference

- [ ] **Add in-app tooltips**
  - Hover tooltips for all controls
  - Explain technical parameters (FFT size, window function)
  - Link to external resources (UHD manual, SigMF spec)

- [ ] **Create video tutorials**
  - 5-minute quickstart video
  - 10-minute deep dive on spectrum analysis
  - 5-minute recording workflow demo

**Estimated Time**: 6-8 hours

---

#### 5.2 Deployment Automation
- [ ] **Create systemd service file**
  ```ini
  [Unit]
  Description=Ettus B210 SDR Web Application
  After=network.target

  [Service]
  Type=simple
  User=ubuntu
  WorkingDirectory=/home/ubuntu/ettus-sdr-web
  Environment="SDR_MODE=production"
  Environment="NODE_ENV=production"
  ExecStart=/usr/bin/pnpm start
  Restart=always

  [Install]
  WantedBy=multi-user.target
  ```

- [ ] **Create deployment script**
  ```bash
  #!/bin/bash
  # deploy.sh
  git pull origin main
  pnpm install
  pnpm db:push
  cd hardware/build && make && cd ../..
  sudo systemctl restart ettus-sdr-web
  ```

- [ ] **Add health check endpoint**
  - GET /api/health
  - Returns: { status: "ok", mode: "production", uptime: 12345 }
  - Use for monitoring and alerting

**Estimated Time**: 3-4 hours

---

## Phase 6: Advanced Features (OPTIONAL)

**Goal**: Add nice-to-have features for power users

**Status**: 🔴 Not Started

### Tasks

#### 6.1 Signal Processing Features
- [ ] **Add demodulation modes**
  - AM demodulation
  - FM demodulation
  - SSB demodulation
  - Audio output via Web Audio API

- [ ] **Add automatic gain control (AGC)**
  - Implement AGC algorithm in C++
  - Add AGC speed control (fast, medium, slow)
  - Show AGC state in UI

- [ ] **Add squelch threshold**
  - Mute audio when signal < threshold
  - Show squelch indicator in UI
  - Add squelch level slider

**Estimated Time**: 8-10 hours

---

#### 6.2 Advanced Recording Features
- [ ] **Add scheduled recordings**
  - Set start time and duration
  - Recurring recordings (daily, weekly)
  - Email notification on completion

- [ ] **Add recording presets**
  - Save frequency, gain, sample rate as preset
  - Quick-load presets for common scenarios
  - Share presets with other users

- [ ] **Add cloud storage integration**
  - Upload recordings to S3/Google Drive
  - Auto-delete local files after upload
  - Share recordings via public link

**Estimated Time**: 6-8 hours

---

#### 6.3 Multi-User Features
- [ ] **Add user roles (admin, operator, viewer)**
  - Admin: Full control, can manage users
  - Operator: Can control hardware, record
  - Viewer: Read-only access

- [ ] **Add activity log**
  - Log all hardware commands (frequency, gain, sample rate)
  - Log all recordings (start, stop, delete)
  - Show audit trail for compliance

- [ ] **Add concurrent user support**
  - Multiple users can view spectrum simultaneously
  - Only one user can control hardware at a time
  - Show "Hardware in use by [user]" message

**Estimated Time**: 8-10 hours

---

## Summary & Timeline

### Completion Estimate

| Phase | Priority | Status | Estimated Time |
|-------|----------|--------|----------------|
| Phase 1: Frontend-Backend Integration | HIGH | 🟡 50% | 18-23 hours |
| Phase 2: Hardware Deployment & Testing | HIGH | 🔴 0% | 7-10 hours |
| Phase 3: Performance Optimization | MEDIUM | 🔴 0% | 9-12 hours |
| Phase 4: UX Enhancements | MEDIUM | 🔴 0% | 8-11 hours |
| Phase 5: Documentation & Deployment | LOW | 🔴 0% | 9-12 hours |
| Phase 6: Advanced Features | OPTIONAL | 🔴 0% | 22-28 hours |

**Total Time to MVP (Phases 1-2)**: 25-33 hours (~1 week full-time)

**Total Time to Production (Phases 1-5)**: 51-68 hours (~2 weeks full-time)

**Total Time with Advanced Features (All Phases)**: 73-96 hours (~3 weeks full-time)

---

## Critical Path to MVP

To get the application to **Minimum Viable Product (MVP)** status for demo/production use:

1. **Complete Phase 1 (Frontend-Backend Integration)** - 18-23 hours
   - Wire all pages to backend
   - Implement WebSocket FFT streaming
   - Add real-time status updates

2. **Complete Phase 2 (Hardware Deployment)** - 7-10 hours
   - Build C++ binaries on gx10-alpha
   - Verify B210 hardware integration
   - Test production mode end-to-end

**MVP Timeline**: 1 week full-time (25-33 hours)

---

## Recommended Next Steps

1. **Start with Phase 1.1** (Spectrum WebSocket Integration) - This is the most visible feature and will immediately show real RF data
2. **Then Phase 1.3** (Recording Integration) - Critical for capturing data
3. **Then Phase 2** (Hardware Deployment) - Verify everything works on real hardware
4. **Polish with Phase 4** (UX Enhancements) - Make it production-ready
5. **Document with Phase 5** (Documentation) - Enable others to use it

---

## Questions & Decisions Needed

1. **Deployment Target**: Will this run on gx10-alpha only, or do we need multi-server support?
2. **User Access**: Single user or multi-user? If multi-user, what roles/permissions?
3. **Data Retention**: How long should recordings be kept? Auto-delete after X days?
4. **Cloud Integration**: Do we need S3/cloud storage, or local storage only?
5. **Advanced Features**: Which Phase 6 features are must-haves vs nice-to-haves?

---

## Contact & Support

For questions or issues during implementation:
- Check DEPLOYMENT-GX10-ALPHA.md for hardware setup
- Check SDR_MODE_GUIDE.md for demo/production mode details
- Check todo.md for granular task tracking
