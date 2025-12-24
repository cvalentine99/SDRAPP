# Ettus B210 SDR Web Application - System Architecture

## Overview

The Ettus B210 SDR Web Application is a full-stack real-time software-defined radio control and visualization system designed for bare metal deployment on ARM64 hardware (gx10-alpha).

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Browser"
        UI[React Frontend<br/>Spectrum/Device/Telemetry/Recording Pages]
        WS_CLIENT[WebSocket Client<br/>FFT Data Stream]
        TRPC_CLIENT[tRPC Client<br/>API Calls]
    end
    
    subgraph "Node.js Server (Express)"
        TRPC_SERVER[tRPC Server<br/>Device/Telemetry/Recording/Scanner Routers]
        WS_SERVER[WebSocket Server<br/>/ws/fft Endpoint]
        HW_MGR[Hardware Manager<br/>Demo/Production Mode]
        AUTH[Manus OAuth<br/>Session Management]
    end
    
    subgraph "C++ Daemons"
        SDR_STREAMER[sdr_streamer<br/>Real-time FFT @ 60 FPS]
        IQ_RECORDER[iq_recorder<br/>IQ Sample Recording]
        FREQ_SCANNER[freq_scanner<br/>Frequency Scanning]
    end
    
    subgraph "Hardware Layer"
        B210[Ettus B210 USRP<br/>USB 3.0]
        GPSDO[GPSDO<br/>GPSTCXO v3.2]
    end
    
    subgraph "Database"
        DB[(MySQL/TiDB<br/>Recordings Table)]
    end
    
    UI --> TRPC_CLIENT
    UI --> WS_CLIENT
    
    TRPC_CLIENT -->|HTTP/tRPC| TRPC_SERVER
    WS_CLIENT -->|WebSocket| WS_SERVER
    
    TRPC_SERVER --> HW_MGR
    TRPC_SERVER --> AUTH
    TRPC_SERVER --> DB
    
    WS_SERVER --> HW_MGR
    
    HW_MGR -->|spawn/control| SDR_STREAMER
    HW_MGR -->|spawn/control| IQ_RECORDER
    HW_MGR -->|spawn/control| FREQ_SCANNER
    
    SDR_STREAMER -->|JSON stdout| HW_MGR
    IQ_RECORDER -->|Binary file| DB
    FREQ_SCANNER -->|JSON stdout| HW_MGR
    
    SDR_STREAMER -->|UHD API| B210
    IQ_RECORDER -->|UHD API| B210
    FREQ_SCANNER -->|UHD API| B210
    
    B210 --> GPSDO
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant WebSocket
    participant HardwareManager
    participant sdr_streamer
    participant B210
    
    User->>Browser: Click START button
    Browser->>HardwareManager: trpc.device.setFrequency(915MHz)
    HardwareManager->>sdr_streamer: spawn with --freq 915e6
    sdr_streamer->>B210: Configure USRP (UHD API)
    B210-->>sdr_streamer: Hardware ready
    
    loop Every 16.67ms (60 FPS)
        sdr_streamer->>B210: Receive IQ samples
        B210-->>sdr_streamer: IQ buffer
        sdr_streamer->>sdr_streamer: Compute FFT
        sdr_streamer->>HardwareManager: JSON FFT data (stdout)
        HardwareManager->>WebSocket: Broadcast FFT
        WebSocket-->>Browser: FFT data
        Browser->>Browser: Update waterfall display
    end
    
    User->>Browser: Click STOP button
    Browser->>HardwareManager: Stop streaming
    HardwareManager->>sdr_streamer: SIGTERM
    sdr_streamer->>B210: Stop acquisition
```

## Component Breakdown

### Frontend (React 19 + Tailwind 4)

**Pages:**
- `Spectrum.tsx` - Main dashboard with waterfall/spectrograph visualization
- `Device.tsx` - Hardware control (frequency, gain, sample rate)
- `Telemetry.tsx` - Real-time metrics (temperature, GPS/PLL lock, USB bandwidth)
- `Recording.tsx` - IQ sample recording management
- `Scanner.tsx` - Frequency scanning with peak detection
- `AIAssistant.tsx` - AI-powered SDR assistance

**Components:**
- `WaterfallDisplay.tsx` - WebGL-accelerated waterfall visualization
- `SpectrographDisplay.tsx` - SVG frequency-domain plot
- `SDRLayout.tsx` - Navigation and footer with device info

**State Management:**
- tRPC hooks for server communication
- WebSocket hooks for real-time FFT streaming
- React state for UI controls

### Backend (Node.js + Express + tRPC)

**Routers:**
- `device-router.ts` - Hardware control procedures (setFrequency, setGain, setSampleRate, getConfig, getStatus)
- `telemetry-router.ts` - Metrics query (getMetrics)
- `recording-router.ts` - Recording CRUD (list, start, delete)
- `scanner-router.ts` - Frequency scanning (startScan)

**Core Services:**
- `hardware.ts` - Hardware manager with demo/production mode
- `websocket.ts` - WebSocket server for FFT streaming
- `auth` - Manus OAuth integration
- `db.ts` - Database helpers

### C++ Daemons (UHD 4.x)

**sdr_streamer:**
- Real-time FFT computation at 60 FPS
- Outputs JSON to stdout: `{"timestamp": ..., "centerFreq": ..., "sampleRate": ..., "fftData": [...]}`
- Configurable via command-line args: `--freq`, `--rate`, `--gain`, `--fft-size`

**iq_recorder:**
- Records raw IQ samples to binary file
- Metadata stored in database
- Configurable duration and file path

**freq_scanner:**
- Scans frequency range with FFT analysis
- Outputs JSON peak detection results
- Configurable start/stop/step frequencies

### Database Schema

```sql
CREATE TABLE recordings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId VARCHAR(255) NOT NULL,
  frequency BIGINT NOT NULL,
  sampleRate BIGINT NOT NULL,
  duration INT NOT NULL,
  filePath VARCHAR(500) NOT NULL,
  fileSize BIGINT NOT NULL,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (userId),
  INDEX idx_created (createdAt)
);
```

## Deployment Architecture

```
gx10-alpha (ARM64 Ubuntu 22.04)
├── /opt/ettus-sdr-web/
│   ├── server/                 # Node.js backend
│   ├── client/dist/            # Built React frontend
│   ├── hardware/bin/           # C++ binaries (sdr_streamer, iq_recorder, freq_scanner)
│   ├── hardware/bin/uhd/       # UHD tools (uhd_find_devices, uhd_usrp_probe, etc.)
│   ├── recordings/             # IQ sample storage
│   ├── .env                    # Environment variables
│   └── package.json
├── /etc/systemd/system/
│   └── ettus-sdr-web.service  # Systemd service
└── /etc/nginx/sites-available/
    └── ettus-sdr-web           # Nginx reverse proxy
```

## Network Architecture

```
Internet
    ↓
[Nginx Reverse Proxy :80/:443]
    ↓
[Node.js Server :3000]
    ├── HTTP/tRPC API
    ├── WebSocket /ws/fft
    └── Static Files (React SPA)
```

## Security Considerations

1. **Authentication**: Manus OAuth with JWT session cookies
2. **Authorization**: User-scoped recording access via `userId` in database
3. **Network**: Nginx reverse proxy with HTTPS (Let's Encrypt)
4. **Process Isolation**: C++ daemons run as child processes, killed on error
5. **Resource Limits**: Systemd service with memory/CPU limits

## Performance Characteristics

- **FFT Rate**: 60 FPS (16.67ms latency)
- **WebSocket Throughput**: ~120 KB/s (2048-point FFT @ 60 FPS)
- **Database**: <10ms query latency for recording list
- **Frontend**: 60 FPS waterfall rendering via WebGL
- **Memory**: ~200 MB Node.js + ~50 MB per C++ daemon

## Monitoring & Logging

- **Application Logs**: `journalctl -u ettus-sdr-web -f`
- **Hardware Logs**: sdr_streamer stderr output
- **Metrics**: Telemetry router provides real-time hardware status
- **Health Check**: `/api/health` endpoint (TODO)

## Failure Modes & Recovery

1. **B210 Disconnected**: Hardware manager detects error, switches to demo mode
2. **C++ Daemon Crash**: Hardware manager respawns process automatically
3. **WebSocket Disconnect**: Client auto-reconnects with exponential backoff
4. **Database Unavailable**: Recording operations fail gracefully, UI shows error
5. **GPSDO Unlock**: Telemetry shows GPS lock status, continues operation

## Scaling Considerations

- **Single B210**: Current architecture supports one B210 per server
- **Multi-User**: Database and auth support multiple concurrent users
- **Multi-USRP**: Future enhancement requires hardware manager refactor
- **Distributed**: WebSocket broadcast can be extended to Redis pub/sub

## Technology Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind 4, TypeScript, WebGL |
| Backend | Node.js 22, Express 4, tRPC 11, TypeScript |
| Database | MySQL 8 / TiDB |
| Hardware | Ettus B210, UHD 4.x, GPSDO |
| C++ Daemons | C++17, UHD API, FFTW3, Boost |
| Deployment | Ubuntu 22.04 ARM64, systemd, Nginx |
| Auth | Manus OAuth, JWT |
