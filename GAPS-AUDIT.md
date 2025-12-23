# Frontend-Backend Connection Gaps Audit

## Critical Gaps Found

### 1. Device Page - COMPLETELY DISCONNECTED ❌
**File:** `client/src/pages/Device.tsx`
**Issue:** Zero tRPC calls - all controls are UI-only, no backend integration
**Impact:** Frequency/gain/sample rate changes don't affect hardware
**Backend Available:**
- `trpc.device.getConfig` - Get current device configuration
- `trpc.device.updateConfig` - Update device configuration  
- `trpc.device.setFrequency` - Set hardware frequency
- `trpc.device.setGain` - Set hardware gain
- `trpc.device.setSampleRate` - Set hardware sample rate

**Fix Required:**
- Wire frequency slider to `trpc.device.setFrequency.useMutation()`
- Wire gain slider to `trpc.device.setGain.useMutation()`
- Wire sample rate dropdown to `trpc.device.setSampleRate.useMutation()`
- Load initial values from `trpc.device.getConfig.useQuery()`
- Add loading states and error handling

### 2. GPU Router - NOT EXPORTED ❌
**File:** `server/gpu-router.ts`
**Issue:** gpuRouter defined but not added to appRouter
**Impact:** Frontend can't call GPU metrics endpoints (though currently just a placeholder)
**Fix Required:**
- Add `gpu: gpuRouter` to appRouter in `server/routers.ts`

### 3. Recording Page - Hardware Integration Commented Out ⚠️
**File:** `client/src/pages/Recording.tsx` lines 95-102
**Issue:** Real hardware IQ recording calls are commented out with TODOs
**Backend Available:**
- `trpc.recording.startIQRecording` - Start hardware IQ capture
- `trpc.recording.uploadRecordedIQ` - Upload captured IQ file to S3

**Current State:** Uses simulated IQ data generation
**Fix Required:**
- Uncomment and wire `startIQRecording` mutation
- Uncomment and wire `uploadRecordedIQ` mutation
- Remove simulated IQ generation
- Add proper error handling for hardware failures

## Working Integrations ✅

### Scanner Page
- ✅ `trpc.scanner.start.useMutation()` - Start frequency scan
- ✅ `trpc.scanner.stop.useMutation()` - Stop scan
- ✅ `trpc.scanner.getStatus.useQuery()` - Poll scan status

### Recording Page (Partial)
- ✅ `trpc.recording.list.useQuery()` - List recordings
- ✅ `trpc.recording.create.useMutation()` - Create recording metadata
- ✅ `trpc.recording.delete.useMutation()` - Delete recording
- ✅ `trpc.recording.uploadIQData.useMutation()` - Upload IQ data to S3

### Telemetry
- ✅ `trpc.telemetry.getMetrics.useQuery()` - Get real-time metrics

### AI Assistant
- ✅ `trpc.ai.chat.useMutation()` - AI chat
- ✅ `trpc.ai.analyzeIQFile.useMutation()` - Analyze IQ files

## Priority Fixes

1. **P0 - Device Page Integration** (30 min)
   - Critical: Hardware controls don't work without this
   - High user impact: Core SDR functionality

2. **P1 - Recording Hardware Integration** (45 min)
   - Important: Currently using fake data
   - Medium user impact: Can't capture real signals

3. **P2 - GPU Router Export** (5 min)
   - Low impact: Router is just a placeholder anyway
   - Quick fix: One line change

## Total Estimated Fix Time: 1.5 hours
