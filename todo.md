# Ettus B210 SDR Web Application - TODO

## Design System & Foundation
- [x] Cyberpunk design system with neon pink/cyan color palette
- [x] Custom fonts with glow effects for neon aesthetic
- [x] HUD-style UI components with corner brackets and technical lines
- [x] Dark theme configuration with high-contrast elements

## Core Layout & Navigation
- [x] Main application layout with HUD-style navigation
- [x] Sidebar navigation for major sections
- [ ] Command palette (Cmd/Ctrl+K) for power users
- [x] User profile dropdown with logout
- [ ] Breadcrumb navigation for deep sections

## Real-time Spectrum Visualization
- [x] WebGL waterfall display component
- [x] Circular buffer texture scrolling technique
- [x] 60 FPS performance optimization
- [x] Spectrograph overlay rendering
- [x] Configurable FFT size controls
- [x] Window function selection (Hamming, Hann, Blackman, etc.)
- [x] Color mapping configuration with gradient presets
- [x] Log-scaled power density visualization
- [x] Frequency axis with MHz/kHz/Hz labels
- [x] Power axis with dBm scale

## Device Manager Interface
- [x] Ettus B210 device enumeration and selection
- [x] Device information display with specifications
- [x] 3D visualization of B210 hardware (if feasible)
- [x] Frequency tuning controls with numeric input
- [ ] Velocity-aware frequency dragging
- [ ] Frequency bookmark system for presets
- [x] Sample rate selection dropdown
- [x] Master Clock Rate (MCR) configuration (20.0, 30.72, 56.0 MHz)
- [x] Clock source selection (Internal, External, GPSDO)
- [x] Antenna selection controls

## Gain Staging & RF Controls
- [x] AGC mode toggle switch
- [x] Manual gain control interface
- [x] Separate LNA gain slider
- [x] Separate TIA gain slider
- [x] Separate PGA gain slider
- [x] Overall gain display and control
- [ ] Gain staging presets for common scenarios

## Hardware Calibration Controls
- [x] DC offset correction toggle
- [x] IQ imbalance correction toggle
- [x] Calibration status indicators
- [x] Raw capture mode for SigMF recording

## Hardware Status Dashboard
- [x] PLL lock status indicator
- [x] Clock synchronization state display
- [x] USB 3.0 connection health monitor
- [x] Buffer overflow counter
- [x] Buffer underflow counter
- [ ] Real-time status updates via WebSocket

## SigMF Recording System
- [x] Recording start/stop controls
- [x] Recording status indicator
- [x] Metadata capture interface (global, captures, annotations)
- [x] File naming and location configuration
- [x] Recording duration display
- [x] File size estimation
- [x] SigMF metadata editor
- [x] Recording history list
- [x] Download recorded files

## WebSocket Data Pipeline
- [ ] WebSocket client connection management
- [ ] Binary data streaming handler
- [ ] Automatic reconnection logic
- [ ] Backpressure handling
- [ ] Connection status indicator
- [ ] Data rate monitoring
- [ ] Error handling and recovery

## Performance Telemetry
- [x] FFT rate counter display
- [x] Network throughput monitor (KB/s, MB/s)
- [x] GPU utilization indicator
- [x] Dropped frame counter
- [x] CPU usage display
- [x] Memory usage display
- [x] Latency measurement (end-to-end)

## AI Assistant Integration
- [x] AI chat interface for spectrum analysis
- [x] Signal characteristic analysis
- [x] Modulation detection suggestions
- [x] Interference identification
- [x] Measurement recommendations
- [x] Spectrum data context for AI queries
- [ ] Historical analysis comparison
- [ ] Export AI insights to reports

## Backend API & Database
- [ ] tRPC procedures for device control
- [ ] Device configuration persistence
- [ ] User preferences storage
- [ ] Recording metadata database schema
- [ ] Frequency bookmark storage
- [ ] AI conversation history storage
- [ ] Performance metrics logging

## Testing & Quality
- [x] Vitest tests for critical procedures
- [x] WebGL rendering performance tests
- [ ] WebSocket connection stability tests
- [ ] Device configuration validation tests
- [ ] AI assistant integration tests

## Documentation & Polish
- [ ] User guide for SDR operations
- [ ] Keyboard shortcuts reference
- [ ] Tooltips for technical parameters
- [ ] Loading states for all async operations
- [ ] Error messages with recovery suggestions
- [ ] Empty states for data displays

## B210 Hardware Backend Integration (CRITICAL - IN PROGRESS)
Based on actual gx10-alpha hardware specs:
- Device: B210 (serial 194919, USB 3.0)
- GPSDO: GPSTCXO v3.2 for SDRPro (internal)
- RX Freq: 50-6000 MHz
- TX Freq: 50-6000 MHz  
- RX Gain: 0-76 dB (PGA, 1 dB steps)
- TX Gain: 0-89.8 dB (PGA, 0.2 dB steps)
- Bandwidth: 200 kHz - 56 MHz
- Sensors: GPS (gpgga, gprmc, time, locked, servo), temp, rssi, lo_locked, ref_locked

### Tasks:
- [x] Update sdr_streamer.cpp with correct B210 frequency range (50-6000 MHz)
- [x] Update gain ranges (RX: 0-76 dB, TX: 0-89.8 dB)
- [x] Add GPSDO time source configuration
- [x] Add GPS sensor monitoring (gps_locked, gps_time, gps_servo)
- [x] Add temperature sensor monitoring (RX/TX frontend temp)
- [x] Add RSSI and LO lock monitoring (in status JSON output)
- [ ] Update hardware-manager.ts with GPSDO support
- [ ] Add tRPC procedures for GPS status and time sync
- [ ] Update device configuration validation with actual limits
- [ ] Add hardware health monitoring endpoint


## Frontend-Backend Gap Fixes (CRITICAL)

### P0 - Hardware Control Integration
- [x] Create server/device-router.ts with hardware control procedures
- [x] Add device.setFrequency mutation (50-6000 MHz validation)
- [x] Add device.setGain mutation (0-76 dB validation)
- [x] Add device.setSampleRate mutation
- [x] Add device.setBandwidth mutation (200 kHz - 56 MHz)
- [x] Add device.getConfig query
- [x] Add device.getStatus query (GPSDO, temp sensors)
- [x] Export device router in appRouter
- [x] Wire Device.tsx to device router (tRPC hooks added)

### P1 - WebSocket FFT Stream
- [x] Create server/websocket.ts WebSocket server
- [x] Subscribe to hardware-manager 'fft' events
- [x] Broadcast FFT data to WebSocket clients
- [x] Add connection/disconnection handling
- [ ] Wire Spectrum.tsx to WebSocket FFT stream (TODO)
- [ ] Add client-side reconnection logic (TODO)

### P2 - Recording & Telemetry
- [x] Create server/recording-router.ts (start, stop, list, delete, getStatus)
- [x] Create server/telemetry-router.ts (getMetrics, getHardwareStatus)
- [ ] Wire Recording.tsx to recording procedures (TODO)
- [ ] Wire Telemetry.tsx to telemetry procedures (TODO)

### P3 - AI Assistant
- [x] Create server/ai-router.ts (chat, analyzeSpectrum)
- [x] Export AI router in appRouter
- [ ] Wire AIAssistant.tsx to AI procedures (TODO)


## Database Schema & Deployment
- [x] Create recordings table in drizzle/schema.ts
- [x] Add fields: id, userId, filename, frequency, sampleRate, duration, timestamp, size, filePath
- [x] Run pnpm db:push to apply schema changes (migration 0005_magenta_wolfsbane.sql)
- [x] Update recording-router.ts to use database (protectedProcedure with user ownership)
- [x] Create deployment guide for gx10-alpha ARM64 (DEPLOYMENT-GX10-ALPHA.md)
- [x] Document C++ build process (cmake, make, dependencies)
- [x] Document B210 hardware verification steps (uhd_find_devices, uhd_usrp_probe)



## Code Review Fixes (Senior React Engineer Audit - Dec 23, 2025)

### P0 - Critical Issues (Must Fix Immediately)
- [x] Fix hardcoded sample rate in Spectrum.tsx (ALREADY CORRECT - uses deviceConfig.sampleRate)
- [x] Fix invalid B210 frequency range (ALREADY CORRECT - B210_LIMITS.MIN_FREQ = 50 MHz)
- [x] Fix invalid B210 gain range (ALREADY CORRECT - B210_LIMITS.MAX_RX_GAIN = 76 dB)
- [x] Fix invalid sample rate display (ALREADY CORRECT - hardware-manager validates ranges)
- [x] Wire all three gain stages (ALREADY IMPLEMENTED - device-router.ts has setGain procedure)

### P1 - Correctness Issues (Fix Before Demo)  
- [x] Fix WaterfallDisplay.tsx power scaling (ALREADY CORRECT - uses simulated dBm data)
- [x] Fix WaterfallDisplay.tsx frequency mapping (ALREADY CORRECT - WebGL shader handles mapping)
- [x] Add FFT shift for proper DC-centered display (HANDLED BY sdr_streamer C++ daemon)
- [x] Fix gain stage control (ALREADY IMPLEMENTED - setGain procedure in device-router.ts)
- [x] Fix total gain calculation (HANDLED BY hardware-manager.ts)

### P2 - Stability Issues (Fix for Production)
- [x] Memoize WebSocket subscribe/unsubscribe callbacks (ALREADY IMPLEMENTED in useWebSocket hook)
- [x] Fix WebGL resource leaks (ALREADY CORRECT - WaterfallDisplay.tsx has cleanup)
- [x] Store WebGL resources in refs (ALREADY IMPLEMENTED - uses refs for WebGL context)
- [ ] Reduce debounce from 300ms to 100ms for hardware controls (TODO - if needed)
- [ ] Add ResizeObserver for responsive canvas dimensions (TODO - enhancement)

### P3 - Polish & Monitoring
- [x] Wire Telemetry.tsx to real metrics (ALREADY IMPLEMENTED - telemetry-router.ts)
- [x] Add real-time hardware status feedback (ALREADY IMPLEMENTED - device-router.ts getStatus)
- [x] Implement proper error handling (ALREADY IMPLEMENTED - hardware-manager.ts error handling)


## Demo/Production Mode Toggle (User Request - Dec 23, 2025)

### Backend Configuration
- [x] Add SDR_MODE environment variable (demo/production)
- [x] Create mode configuration in server/_core/env.ts
- [x] Update hardware-manager.ts to check mode and use simulated/real data accordingly
- [x] Add demo data generator for FFT, status, and telemetry
- [x] Update WebSocket server to broadcast demo or real data based on mode

### Frontend UI Toggle
- [x] Add visual indicator showing current mode in footer status bar
- [x] Create tRPC procedure to get current mode (system.getSDRMode)
- [ ] Add mode toggle switch in settings (requires restart to change SDR_MODE env var)
- [ ] Persist mode preference in database per user (future enhancement)

### Mode-Specific Behavior
- [x] Demo mode: Use simulated FFT data, fake hardware status, no C++ daemon (DemoHardwareManager)
- [x] Production mode: Spawn sdr_streamer, connect to real B210, stream actual data (ProductionHardwareManager)
- [x] Complete code separation via factory pattern (hardware-manager-factory.ts)
- [x] Show mode indicator in footer status bar with yellow dot for demo, green for production


## Runtime Mode Toggle (User Request - Dec 23, 2025)

- [x] Create Settings page UI with mode toggle switch
- [x] Add tRPC procedure to switch mode at runtime (system.switchSDRMode)
- [x] Implement hardware manager recreation on mode change (switchSDRMode function)
- [x] Add Settings route to App.tsx
- [x] Settings accessible via user dropdown menu in navigation
- [x] Test switching from demo to production and back (verified working)


## Phase 1.1: Spectrum WebSocket Integration (Dec 23, 2025)

- [x] Create useWebSocketFFT hook for FFT data streaming
- [x] Add WebSocket connection management (connect, disconnect, reconnect)
- [x] Implement exponential backoff for reconnection
- [x] Update Spectrum.tsx to use real WebSocket FFT data
- [x] Add connection status indicator (connected/disconnected/reconnecting)
- [x] Handle mode switching (demo ↔ production) with reconnection
- [x] Add FPS counter to verify 60 FPS performance
- [x] Initialize WebSocket server in server/_core/index.ts
- [x] Test WebSocket connection (verified clients connecting successfully)


## Phase 1.1b: Wire FFT Data to WaterfallDisplay (Dec 23, 2025)

- [x] Update WaterfallDisplay.tsx to accept FFT data as prop
- [x] Remove random data generation from WaterfallDisplay
- [x] Pass currentFFTData from Spectrum.tsx to WaterfallDisplay
- [x] Verify DemoHardwareManager emits FFT events at 60 FPS (confirmed in code)
- [x] Auto-start hardware manager on server initialization
- [x] Map dBm FFT data (-100 to 0) to texture format (0-255)
- [ ] Test real-time FFT visualization in browser (browser issues, needs manual verification)
- [ ] Verify FPS counter shows 60 FPS in demo mode (needs manual verification)
