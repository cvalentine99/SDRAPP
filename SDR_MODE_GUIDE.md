# SDR Mode Configuration Guide

## Overview

The Ettus SDR Web Application supports two distinct operating modes:

- **DEMO MODE** (default): Uses simulated FFT data for testing without physical B210 hardware
- **PRODUCTION MODE**: Connects to real Ettus B210 USRP hardware via C++ daemon

## Architecture

### Complete Code Separation

The application uses a **factory pattern** to ensure 100% separation between demo and production code:

```
hardware-manager-factory.ts  ← Factory (selects mode based on SDR_MODE env var)
    ├── demo-hardware-manager.ts        ← DEMO: Simulated data generator
    └── production-hardware-manager.ts  ← PRODUCTION: Real B210 integration
```

### Mode Detection

Mode is determined by the `SDR_MODE` environment variable:

```bash
# Demo mode (default)
SDR_MODE=demo

# Production mode
SDR_MODE=production
```

## Demo Mode

### Features
- ✅ Simulated FFT data at 60 FPS
- ✅ Realistic signal peaks at 915.5 MHz, 916.2 MHz, 914.8 MHz
- ✅ Fake hardware status (temperature, frame count)
- ✅ No C++ daemon required
- ✅ Instant configuration updates (no hardware restart)
- ✅ Safe for testing UI/UX without hardware

### Use Cases
- Frontend development
- UI/UX testing
- Demo presentations
- Development without B210 hardware

### Behavior
- Generates realistic noise floor + signal peaks
- Updates FFT display at 60 FPS
- Status updates every 5 seconds
- No actual hardware commands sent

## Production Mode

### Features
- ✅ Spawns `sdr_streamer` C++ daemon
- ✅ Real B210 USRP hardware integration
- ✅ Actual FFT data from RF environment
- ✅ GPSDO time synchronization
- ✅ Hardware sensor monitoring (temperature, PLL lock)
- ✅ Configuration changes restart daemon

### Requirements
- Ettus B210 connected via USB 3.0
- C++ binaries compiled in `hardware/build/`
- UHD library installed on system

### Behavior
- Spawns `./hardware/build/sdr_streamer` process
- Parses JSON output from daemon
- Restarts daemon when configuration changes
- Monitors process health and auto-recovery

## Switching Modes

### Method 1: Environment Variable (Recommended)

Set `SDR_MODE` before starting the server:

```bash
# Start in demo mode
SDR_MODE=demo pnpm dev

# Start in production mode
SDR_MODE=production pnpm dev
```

### Method 2: .env File

Add to your `.env` file:

```env
SDR_MODE=demo
```

or

```env
SDR_MODE=production
```

Then restart the server:

```bash
pnpm dev
```

### Method 3: System Environment (Deployment)

For production deployment on gx10-alpha:

```bash
# Add to systemd service file
Environment="SDR_MODE=production"
```

## Visual Indicators

The application shows the current mode in the footer status bar:

### Demo Mode
```
🟡 DEMO MODE (SIMULATED DATA)
```

### Production Mode
```
🟢 PRODUCTION MODE
```

## Code Structure

### Shared Types
```typescript
// server/hardware-types.ts
export interface IHardwareManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  // ... common interface
}
```

### Demo Implementation
```typescript
// server/demo-hardware-manager.ts
export class DemoHardwareManager implements IHardwareManager {
  // 100% simulated data
  private generateSimulatedFFT(): FFTData { ... }
}
```

### Production Implementation
```typescript
// server/production-hardware-manager.ts
export class ProductionHardwareManager implements IHardwareManager {
  // 100% real hardware
  private process: ChildProcess;
  private parseHardwareOutput(data: string): void { ... }
}
```

### Factory
```typescript
// server/hardware-manager-factory.ts
export function getHardwareManager(): IHardwareManager {
  if (ENV.sdrMode === 'production') {
    return new ProductionHardwareManager();
  } else {
    return new DemoHardwareManager();
  }
}
```

## API Endpoints

### Get Current Mode

```typescript
const { data } = trpc.system.getSDRMode.useQuery();
// { mode: "demo", isDemo: true, isProduction: false }
```

### Get System Info

```typescript
const { data } = trpc.system.getSystemInfo.useQuery();
// { sdrMode: "demo", nodeEnv: "development", platform: "linux", arch: "arm64" }
```

## Deployment Examples

### Development (Demo Mode)
```bash
cd /home/ubuntu/ettus-sdr-web
SDR_MODE=demo pnpm dev
```

### Testing with Hardware (Production Mode)
```bash
cd /home/ubuntu/ettus-sdr-web
SDR_MODE=production pnpm dev
```

### Production Deployment (gx10-alpha)
```bash
# Build C++ binaries first
cd hardware/build
cmake ..
make

# Start server in production mode
cd /home/ubuntu/ettus-sdr-web
SDR_MODE=production pnpm start
```

## Troubleshooting

### Demo Mode Not Working
- Check console for `[HW-FACTORY] Creating DEMO hardware manager`
- Verify SDR_MODE is not set to "production"
- Restart server after changing environment variable

### Production Mode Not Working
- Check console for `[HW-FACTORY] Creating PRODUCTION hardware manager`
- Verify C++ binaries exist: `ls hardware/build/sdr_streamer`
- Check B210 connection: `uhd_find_devices`
- Review daemon logs in console output

### Mode Not Changing
- Environment variables are read at server startup only
- Must restart server after changing SDR_MODE
- Check `.env` file doesn't override your shell variable

## Best Practices

1. **Default to Demo Mode**: Set `SDR_MODE=demo` as default in `.env` for safety
2. **Explicit Production**: Only use production mode when hardware is connected
3. **Log Mode on Startup**: Console shows which mode is active
4. **Visual Confirmation**: Check footer status bar for current mode
5. **Separate Deployments**: Use demo for staging, production for hardware deployment

## Future Enhancements

- [ ] Runtime mode switching without server restart
- [ ] Per-user mode preference in database
- [ ] Settings page toggle for mode selection
- [ ] Automatic fallback to demo if hardware unavailable
- [ ] Mode-specific feature flags
