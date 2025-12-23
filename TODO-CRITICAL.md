# CRITICAL TODO - Incomplete Implementations

## 🔴 CRITICAL: Recording S3 Upload Stub
**Priority:** HIGH - Must fix before deployment
**File:** `client/src/pages/Recording.tsx:86-89`
**Issue:**
```typescript
// In real implementation, this would upload actual IQ data to S3
// For now, we create a placeholder
const s3Key = `recordings/${filename}.sigmf-data`;
const s3Url = `https://placeholder.s3.amazonaws.com/${s3Key}`;
```

**Impact:** 
- Recordings save metadata to database but NO actual IQ data is captured or stored
- Users cannot download or analyze recorded signals
- S3 URLs point to non-existent placeholder location

**Fix Required:**
- [x] Create tRPC procedure `recording.uploadIQData` that accepts binary IQ data
- [x] Use `storagePut()` from `server/storage.ts` to upload to real S3
- [x] Generate actual binary IQ data during recording (complex float32 format)
- [x] Update `handleStopRecording()` to upload real data and get actual S3 URL
- [x] Test end-to-end: record → upload → download → verify data integrity

**✅ COMPLETED** - Recording now uploads real IQ data to S3 with proper URLs

**Implementation Steps:**
1. Add new tRPC procedure in `server/sdr-routers.ts`:
   ```typescript
   uploadIQData: protectedProcedure
     .input(z.object({
       filename: z.string(),
       data: z.string(), // base64 encoded binary IQ data
     }))
     .mutation(async ({ ctx, input }) => {
       const buffer = Buffer.from(input.data, 'base64');
       const { url, key } = await storagePut(
         `recordings/${ctx.user.id}/${input.filename}`,
         buffer,
         'application/octet-stream'
       );
       return { s3Url: url, s3Key: key };
     })
   ```

2. Update Recording.tsx to generate and upload real IQ data:
   ```typescript
   // Generate simulated IQ samples (replace with real hardware data later)
   const numSamples = Math.floor(currentFileSize / 8); // complex float32 = 8 bytes
   const iqData = new Float32Array(numSamples * 2);
   // ... populate with I/Q samples ...
   
   // Upload to S3
   const { s3Url, s3Key } = await uploadIQData.mutateAsync({
     filename: `${filename}.sigmf-data`,
     data: Buffer.from(iqData.buffer).toString('base64')
   });
   ```

---

## 🟡 MEDIUM: WebSocket Simulated FFT Data
**Priority:** MEDIUM - Needed for real hardware integration
**File:** `server/websocket.ts:79-110`

**Current Implementation:**
```typescript
function generateSimulatedFFT(): FFTData {
  const fftSize = 2048;
  const data: number[] = [];
  
  // Generate simulated spectrum with some peaks
  for (let i = 0; i < fftSize; i++) {
    let value = -100 + Math.random() * 10; // Base noise floor
    
    // Add some signal peaks (hardcoded)
    if (i > 300 && i < 350) value = -45 + Math.random() * 5;
    // ...
  }
  return { timestamp: Date.now(), centerFrequency: 915.0, ... };
}
```

**Impact:**
- Waterfall and spectrograph display fake data with hardcoded signal peaks
- Cannot analyze real RF environment
- Hardware settings (frequency, gain, sample rate) have no effect on display

**Fix Required:**
- [ ] Install UHD or SoapySDR library on server
- [ ] Create B210 device manager class with open/close/configure methods
- [ ] Implement real-time FFT computation from hardware IQ stream
- [ ] Replace `generateSimulatedFFT()` with `captureRealFFT(device)`
- [ ] Add device enumeration and connection management
- [ ] Handle hardware errors and reconnection

**Implementation Steps:**
1. Install UHD library:
   ```bash
   sudo apt-get install libuhd-dev uhd-host
   ```

2. Create device manager (`server/sdr-device.ts`):
   ```typescript
   import { spawn } from 'child_process';
   
   export class B210Device {
     private process: ChildProcess | null = null;
     
     async open(freq: number, rate: number, gain: number) {
       // Use rx_samples_to_file or custom C++ tool
       this.process = spawn('rx_samples_to_file', [
         '--freq', freq.toString(),
         '--rate', rate.toString(),
         '--gain', gain.toString(),
         '--type', 'float',
         '--stdout'
       ]);
       
       this.process.stdout.on('data', (chunk) => {
         const fftData = this.computeFFT(chunk);
         broadcastFFTData(fftData);
       });
     }
     
     computeFFT(iqSamples: Buffer): FFTData {
       // Use fft.js or similar library
       // ...
     }
   }
   ```

3. Update websocket.ts to use real device:
   ```typescript
   const device = new B210Device();
   
   function startRealStream(ws: WebSocket, config: DeviceConfig) {
     device.open(
       parseFloat(config.centerFrequency) * 1e6,
       parseFloat(config.sampleRate) * 1e6,
       config.gain
     );
   }
   ```

---

## 🟡 MEDIUM: Device Controls Don't Control Hardware
**Priority:** MEDIUM - Required for live hardware control
**File:** `client/src/pages/Device.tsx`

**Current Behavior:**
- Frequency slider updates database config only
- Gain controls update database config only
- Sample rate dropdown updates database config only
- NO actual hardware commands are sent

**Impact:**
- User changes settings in UI but B210 hardware remains unchanged
- Spectrum display doesn't reflect UI settings
- Must manually restart hardware with new config

**Fix Required:**
- [ ] Add tRPC procedures: `device.setFrequency`, `device.setGain`, `device.setSampleRate`
- [ ] Implement UHD device control commands in backend
- [ ] Call hardware control procedures from frontend on setting changes
- [ ] Add real-time hardware status feedback (PLL lock, temperature, etc.)
- [ ] Handle hardware errors gracefully

**Implementation Steps:**
1. Add hardware control procedures to `server/sdr-routers.ts`:
   ```typescript
   export const deviceRouter = router({
     // ... existing getConfig, updateConfig ...
     
     setFrequency: protectedProcedure
       .input(z.object({ frequency: z.number() }))
       .mutation(async ({ input }) => {
         await b210Device.setFrequency(input.frequency);
         return { success: true };
       }),
     
     setGain: protectedProcedure
       .input(z.object({ gain: z.number() }))
       .mutation(async ({ input }) => {
         await b210Device.setGain(input.gain);
         return { success: true };
       }),
     
     setSampleRate: protectedProcedure
       .input(z.object({ sampleRate: z.number() }))
       .mutation(async ({ input }) => {
         await b210Device.setSampleRate(input.sampleRate);
         return { success: true };
       }),
     
     getHardwareStatus: protectedProcedure
       .query(async () => {
         return {
           pllLocked: await b210Device.isPLLLocked(),
           temperature: await b210Device.getTemperature(),
           usbConnected: await b210Device.isConnected(),
         };
       }),
   });
   ```

2. Update Device.tsx to call hardware control:
   ```typescript
   const setFrequency = trpc.device.setFrequency.useMutation();
   
   const handleFrequencyChange = async (newFreq: string) => {
     // Update database config
     await updateConfig.mutateAsync({ centerFrequency: newFreq });
     
     // Update hardware
     await setFrequency.mutateAsync({ 
       frequency: parseFloat(newFreq) * 1e6 
     });
   };
   ```

---

## 🟢 LOW: Telemetry Hardcoded Values
**Priority:** LOW - Nice to have, not blocking
**File:** `client/src/pages/Telemetry.tsx`

**Current Implementation:**
```typescript
<div className="text-4xl font-mono text-primary mb-2">60</div> {/* FFT Rate */}
<div className="text-4xl font-mono text-secondary mb-2">123</div> {/* Throughput */}
<div className="text-4xl font-mono text-primary mb-2">45</div> {/* GPU Load */}
<div className="text-4xl font-mono text-secondary mb-2">0</div> {/* Dropped Frames */}
```

**Impact:**
- Telemetry page shows fake static values
- Cannot monitor actual system performance
- No visibility into bottlenecks or issues

**Fix Required:**
- [ ] Create `telemetry.getMetrics` tRPC procedure
- [ ] Implement server-side metrics collection (CPU, GPU, network, FFT rate)
- [ ] Use `useQuery` with polling or WebSocket for real-time updates
- [ ] Display actual metrics in Telemetry page

**Implementation Steps:**
1. Add telemetry router to `server/sdr-routers.ts`:
   ```typescript
   export const telemetryRouter = router({
     getMetrics: protectedProcedure.query(async () => {
       return {
         fftRate: fftRateCounter.getRate(), // Track in websocket.ts
         throughput: networkMonitor.getThroughput(),
         gpuLoad: await getGPUUtilization(),
         cpuLoad: await getCPUUtilization(),
         droppedFrames: droppedFrameCounter.getCount(),
         memoryUsage: process.memoryUsage(),
       };
     }),
   });
   ```

2. Update Telemetry.tsx to fetch real data:
   ```typescript
   const { data: metrics } = trpc.telemetry.getMetrics.useQuery(
     undefined,
     { refetchInterval: 1000 } // Poll every second
   );
   
   <div className="text-4xl font-mono text-primary mb-2">
     {metrics?.fftRate ?? 0}
   </div>
   ```

---

## Priority Order for Implementation

1. **🔴 Recording S3 Upload** (1-2 hours)
   - Most critical for data capture functionality
   - Blocks ability to save and analyze recordings
   - Relatively straightforward fix with existing S3 helpers

2. **🟡 WebSocket Real FFT Data** (4-8 hours)
   - Required for hardware integration
   - More complex: needs UHD/SoapySDR setup
   - Can develop incrementally (simulated → file playback → live hardware)

3. **🟡 Device Hardware Control** (2-4 hours)
   - Needed for live hardware control
   - Depends on WebSocket FFT implementation
   - Straightforward once device manager exists

4. **🟢 Telemetry Real Metrics** (1-2 hours)
   - Nice to have, not blocking
   - Can implement anytime
   - Low complexity

---

## Testing Checklist

### Recording S3 Upload
- [ ] Start recording, stop after 10 seconds
- [ ] Verify IQ data uploaded to S3 (check S3 console)
- [ ] Download recording from UI
- [ ] Verify downloaded file is valid binary IQ data
- [ ] Check file size matches expected (sample_rate * duration * 8 bytes)

### WebSocket Real FFT
- [ ] Connect B210 hardware
- [ ] Verify FFT data updates when changing frequency
- [ ] Verify gain changes affect signal levels
- [ ] Check waterfall shows real RF environment
- [ ] Test reconnection after hardware disconnect

### Device Hardware Control
- [ ] Change frequency in UI, verify hardware tunes
- [ ] Adjust gain, verify signal levels change
- [ ] Switch sample rate, verify bandwidth changes
- [ ] Check hardware status indicators update
- [ ] Test error handling (disconnect hardware)

### Telemetry Real Metrics
- [ ] Verify FFT rate matches actual frame rate
- [ ] Check throughput reflects network traffic
- [ ] Monitor GPU/CPU load under different conditions
- [ ] Verify dropped frames counter increments on overload
