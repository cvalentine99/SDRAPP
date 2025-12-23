# Frontend-Backend Connection Gaps Audit

## Current State (Checkpoint 5eeeb302)

### Existing Backend:
- ✅ `server/routers.ts` - Only has auth router (me, logout)
- ✅ `server/hardware-manager.ts` - NEW: B210 hardware manager with GPSDO support
- ❌ NO device control tRPC procedures
- ❌ NO WebSocket integration with hardware manager
- ❌ NO recording procedures
- ❌ NO telemetry procedures

### Frontend Pages Analysis:

#### 1. **Spectrum.tsx** (Main SDR visualization)
- **Current**: Likely has waterfall/spectrograph UI
- **Missing**: WebSocket connection to hardware FFT stream
- **Needs**: Real-time FFT data from hardware-manager

#### 2. **Device.tsx** (Hardware control)
- **Current**: Probably has sliders/inputs for freq/gain/sample rate
- **Missing**: tRPC mutations to control hardware
- **Needs**: 
  - `device.setFrequency` mutation
  - `device.setGain` mutation  
  - `device.setSampleRate` mutation
  - `device.setBandwidth` mutation
  - `device.getConfig` query
  - `device.getStatus` query (GPSDO, temp sensors)

#### 3. **Recording.tsx** (IQ data capture)
- **Current**: Recording UI
- **Missing**: Backend procedures for IQ recording
- **Needs**:
  - `recording.start` mutation
  - `recording.stop` mutation
  - `recording.list` query
  - `recording.delete` mutation

#### 4. **Telemetry.tsx** (System metrics)
- **Current**: Telemetry display
- **Missing**: Backend telemetry data
- **Needs**:
  - `telemetry.getMetrics` query (FFT rate, throughput, dropped frames)
  - `telemetry.getHardwareStatus` query (GPS, temp, etc.)

#### 5. **AIAssistant.tsx** (AI chat)
- **Current**: AI chat UI
- **Missing**: Backend AI procedures
- **Needs**:
  - `ai.chat` mutation
  - `ai.analyzeSpectrum` mutation

## Critical Gaps to Fix (Priority Order):

### P0 - Hardware Control (CRITICAL)
1. Create `server/device-router.ts` with hardware control procedures
2. Wire hardware-manager to device router
3. Connect Device.tsx to device router

### P1 - Real-time FFT Stream (CRITICAL)
4. Create `server/websocket.ts` WebSocket server
5. Wire hardware-manager FFT events to WebSocket
6. Connect Spectrum.tsx to WebSocket FFT stream

### P2 - Recording & Telemetry
7. Create `server/recording-router.ts`
8. Create `server/telemetry-router.ts`
9. Wire to frontend pages

### P3 - AI Assistant
10. Create `server/ai-router.ts`
11. Wire to AIAssistant.tsx

## Implementation Plan:

1. **Phase 1**: Device control (P0)
   - Create device router with setFrequency, setGain, setSampleRate, getStatus
   - Export in appRouter
   - Wire Device.tsx

2. **Phase 2**: WebSocket FFT stream (P1)
   - Create WebSocket server
   - Subscribe to hardware-manager 'fft' events
   - Broadcast to connected clients
   - Wire Spectrum.tsx

3. **Phase 3**: Recording & Telemetry (P2)
   - Implement recording procedures
   - Implement telemetry procedures
   - Wire frontend pages

4. **Phase 4**: AI Assistant (P3)
   - Implement AI procedures
   - Wire AIAssistant.tsx
