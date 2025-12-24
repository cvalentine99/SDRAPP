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


## Dashboard Device Info Accuracy (Dec 24, 2025)

- [x] Review current Spectrum page dashboard device info display
- [x] Check Device tab for accurate device info source
- [x] Update dashboard to show real B210 device info:
  - [x] Serial number (194919)
  - [x] Device name (MyB210)
  - [x] FW Version (8.0)
  - [x] FPGA Version (16.0)
  - [x] GPSDO status (GPSTCXO v3.2)
  - [x] USB connection (USB 3.0)
- [x] Display in footer status bar on all pages
- [x] Add device info panel to Device tab
- [x] Update frequency range (50 MHz - 6 GHz)
- [x] Update max sample rate (61.44 MSPS)


## Frequency Scanner Feature (Dec 24, 2025)

- [x] Create Scanner.tsx page with scan controls
- [x] Add scanner navigation item to SDRLayout
- [x] Implement scanner backend router (scanner-router.ts)
- [x] Integrate with freq_scanner C++ daemon (demo mode simulated, production uses binary)
- [x] Add scan results visualization (SVG chart + table)
- [x] Add scan progress indicator
- [x] Add export scan results to JSON
- [ ] Test frequency scanning in production mode with real B210

## Production Deployment Preparation (Dec 24, 2025)

- [x] Create PRODUCTION_DEPLOYMENT.md guide
- [x] Document environment variables configuration
- [x] Create systemd service files for auto-start
- [x] Document backup and recovery procedures
- [x] Create deployment checklist
- [x] Add troubleshooting section
- [x] Add security and performance tuning sections
- [ ] Test production mode on gx10-alpha (requires hardware access)


## End-to-End Verification (Dec 24, 2025)

### Backend Verification
- [ ] Check all tRPC routers are registered in routers.ts
- [ ] Verify device-router.ts procedures (setFrequency, setGain, setSampleRate, getStatus)
- [ ] Verify telemetry-router.ts procedures (getMetrics)
- [ ] Verify recording-router.ts procedures (list, start, stop)
- [ ] Verify scanner-router.ts procedures (scan)
- [ ] Verify system router procedures (getSDRMode, switchSDRMode)
- [ ] Check hardware-manager-factory.ts mode switching
- [ ] Verify WebSocket server initialization in _core/index.ts

### Frontend Verification
- [ ] Test Spectrum page - frequency/gain controls, waterfall display
- [ ] Test Scanner page - scan controls, results visualization
- [ ] Test Device page - device info, gain staging, calibration
- [ ] Test Recording page - list recordings, start/stop
- [ ] Test Telemetry page - metrics display
- [ ] Test AI Assistant page - chat functionality
- [ ] Test Settings page - mode toggle
- [ ] Verify navigation works between all pages

### WebSocket Verification
- [ ] Test WebSocket connection on /ws/fft
- [ ] Verify FFT data streaming in demo mode
- [ ] Verify reconnection logic works
- [ ] Test connection status indicators

### Database Verification
- [ ] Verify recordings table schema
- [ ] Verify users table schema
- [ ] Test database migrations with pnpm db:push
- [ ] Verify database connection in production

### Integration Testing
- [ ] Test demo mode end-to-end
- [ ] Test production mode switching
- [ ] Test all tRPC queries and mutations
- [ ] Verify error handling and loading states
- [ ] Test authentication flow


## Frontend-Backend Wiring (Dec 24, 2025)

### Device Page
- [ ] Wire frequency input to trpc.device.setFrequency mutation
- [ ] Wire gain slider to trpc.device.setGain mutation
- [ ] Wire sample rate selector to trpc.device.setSampleRate mutation
- [ ] Add loading states and error handling
- [ ] Display current config from trpc.device.getConfig query

### Telemetry Page
- [ ] Wire to trpc.telemetry.getMetrics query
- [ ] Display real-time metrics (temperature, GPS/PLL lock, USB bandwidth)
- [ ] Add auto-refresh with useQuery refetchInterval
- [ ] Show connection status indicators

### Recording Page
- [ ] Wire to trpc.recording.list query for recordings table
- [ ] Wire START button to trpc.recording.start mutation
- [ ] Wire DELETE buttons to trpc.recording.delete mutation
- [ ] Add recording progress indicator
- [ ] Handle empty state when no recordings exist

### WebSocket FFT Streaming
- [ ] Create WebSocket server endpoint (/ws/fft)
- [ ] Implement FFT data broadcasting from hardware manager
- [ ] Create useWebSocketFFT hook on frontend
- [ ] Wire Spectrum page to WebSocket FFT data
- [ ] Update WaterfallDisplay to consume real FFT data
- [ ] Add connection status indicator
- [ ] Test 60 FPS performance


## Spectrum Page Control Wiring (Dec 24, 2025)

- [x] Wire frequency input to trpc.device.setFrequency mutation
- [x] Wire gain slider to trpc.device.setGain mutation
- [x] Add debouncing to prevent excessive API calls (500ms for frequency, 300ms for gain)
- [x] Implement START/STOP button handler
- [x] Add isRunning state management
- [x] Update button text and icon based on state (Play/START ↔ Pause/STOP)
- [ ] Test frequency tuning from Spectrum page (needs manual testing)
- [ ] Test gain control from Spectrum page (needs manual testing)


## Live Telemetry in Spectrum Page (Dec 24, 2025)

- [x] Add trpc.telemetry.getMetrics query to Spectrum page
- [x] Set 1-second auto-refresh interval
- [x] Replace hardcoded values with real temperature and USB bandwidth
- [x] Add fallback "--" for loading state
- [ ] Test live telemetry updates (needs manual testing)
