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

## Backend Integration (Pre-Deployment)
- [x] Database schema for device configurations
- [x] Database schema for frequency bookmarks
- [x] Database schema for recording metadata
- [x] Database schema for AI conversation history
- [x] tRPC procedure: Get device configuration
- [x] tRPC procedure: Update device configuration (frequency, sample rate, gain)
- [x] tRPC procedure: Save frequency bookmark
- [x] tRPC procedure: List frequency bookmarks
- [x] tRPC procedure: Delete frequency bookmark
- [x] tRPC procedure: Create recording
- [x] tRPC procedure: List recordings
- [x] tRPC procedure: Delete recording
- [x] tRPC procedure: AI assistant chat (with LLM integration)
- [x] WebSocket server setup for FFT data streaming
- [x] WebSocket connection management in frontend
- [x] Frontend: Connect device controls to tRPC procedures
- [ ] Frontend: Connect recording controls to tRPC procedures
- [ ] Frontend: Connect AI assistant to tRPC procedures
- [x] End-to-end testing with simulated data
