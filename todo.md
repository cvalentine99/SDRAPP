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

