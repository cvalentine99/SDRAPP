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

## Frequency Bookmark Management UI (New Feature)
- [x] Bookmark panel component with list view
- [x] Create bookmark dialog with name, frequency, description, category
- [x] Edit bookmark functionality
- [x] Category filter/organization
- [x] Quick-tune buttons in Spectrum page
- [x] Bookmark import/export (JSON)

## SigMF Recording Workflow (New Feature)
- [x] Connect Recording page to tRPC procedures
- [x] S3 upload integration for binary IQ data
- [x] Real-time file size tracking during capture
- [x] Recording progress indicator
- [x] SigMF metadata JSON export
- [x] Recording list with download links
- [x] Delete recording with S3 cleanup
- [ ] Recording playback/analysis (future enhancement)

## Power User Features (New)
- [x] Velocity-aware frequency dragging (slow = 0.1 MHz, medium = 1 MHz, fast = 10 MHz)
- [x] Preset bookmark packs (Amateur Radio, Aviation, ISM, Satellite)
- [x] Command palette with Cmd/Ctrl+K shortcut
- [x] Fuzzy search across pages, bookmarks, settings
- [x] Quick navigation to any page from command palette
- [x] Bookmark search and quick-tune from command palette

## Bug Fixes
- [x] Fix WebSocket rapid reconnection issue during hot reloads
- [x] Improve WebSocket cleanup on component unmount
- [x] Add connection debouncing to prevent reconnection churn
- [x] Fix infinite reconnection loop from stale closure in connect callback
- [x] Fix race condition in live data updates with functional state updates
- [x] Wire reconnect interval from diagnostics panel to actual WebSocket behavior

## WebSocket Enhancements
- [x] Connection status indicator in top navigation (Connected/Reconnecting/Disconnected)
- [x] Color-coded neon glow (cyan=connected, yellow=reconnecting, pink=error)
- [x] Last successful data timestamp display
- [x] FFT data circular buffer (100 frames)
- [x] Waterfall history scrubbing with controls
- [x] Timeline slider for reviewing past spectrum activity
- [x] Reconnection settings panel in Device page
- [x] Configurable auto-retry interval
- [x] Configurable max retry attempts
- [x] Configurable connection timeout
- [x] Manual reconnect button
- [x] Connection diagnostics (latency, packet loss, throughput)

## Advanced Visualization Features
- [x] Waterfall color map preset dropdown (Viridis, Plasma, Inferno, Grayscale, Hot/Cold)
- [x] Custom RGB gradient editor for waterfall
- [x] Color map persistence in device config
- [x] Signal detection markers on spectrograph
- [x] Adjustable peak detection threshold
- [x] Frequency markers with power level labels
- [x] Click-to-tune functionality on detected signals
- [ ] Frequency scan mode configuration panel
- [ ] Scan sweep parameters (start/stop frequency, step size, dwell time)
- [ ] Automated scanning with pause-on-signal detection
- [ ] Scan results table with timestamps and power levels
- [ ] Export scan results to CSV/JSON

## Critical Bug Fixes (High Priority)
- [x] Fix WebSocketContext.tsx import path (verified correct - no issue)
- [x] Fix spectrograph transform compounding (visual corruption)
- [x] Fix waterfall RAF loop recreation (added fftDataRef for future real data)
- [x] Fix WebSocketStatus timestamp (now updates on FFT data arrival)
- [x] Fix WebSocketDiagnostics calculation errors (added guards for Infinity/NaN)

## AI Assistant Redesign
- [x] Create floating chat dialog component (lower right corner)
- [x] Add chat toggle button (visible on all pages)
- [x] Implement signals forensics RAG context
- [x] Add RF analysis knowledge base (modulation types, interference patterns, spectrum techniques)
- [x] Remove AIAssistant page from navigation
- [x] Integrate floating chat into SDRLayout for global access
- [ ] Add conversation persistence to database
- [ ] Enable spectrum snapshot attachments in chat

## IQ Recording File Analysis (New Feature)
- [x] File upload UI in FloatingAIChat (file picker)
- [x] Support for common IQ formats (raw binary, SigMF, WAV)
- [x] Backend IQ file parsing and validation
- [x] Signal characteristic extraction (power, dynamic range)
- [x] AI analysis integration with extracted signal features
- [x] Upload progress indicator and file size limits
- [x] Display analysis results with visualizations

## Remove Broken Bookmark Feature
- [x] Remove BookmarkPanel component from Spectrum page
- [x] Remove bookmark tRPC procedures from sdr-routers.ts
- [x] Remove bookmark database helpers from sdr-db.ts
- [x] Remove frequencyBookmarks table from database schema
- [x] Remove bookmark tests
- [x] Remove preset bookmark packs
- [x] Remove BookmarkPanel component file
- [x] Remove bookmark references from CommandPalette
