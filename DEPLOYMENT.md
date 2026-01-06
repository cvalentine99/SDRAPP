# Ettus SDR Web Application — Production Deployment Guide

**Version:** 1.0  
**Last Updated:** January 6, 2026  
**Author:** Manus AI

---

## Overview

This document provides a comprehensive, safety-first deployment guide for the Ettus SDR Web Application. The application consists of a React frontend, Node.js backend, and native SoapySDR integration with a hardened control plane.

**Critical Safety Notice:** This application controls real radio hardware. All deployment procedures prioritize system stability and RF safety over convenience. TX (transmission) functionality is disabled by default and requires explicit administrative enablement.

---

## Non-Negotiable Safety Rules

Before proceeding with any installation step, all operators must acknowledge and adhere to the following rules:

| Rule | Description |
|------|-------------|
| **No Source Modification** | Do not modify application source code during installation |
| **No System Library Changes** | Do not modify system-wide libraries unless explicitly required |
| **No Hardware Assumptions** | Do not guess or assume hardware configuration |
| **TX Disabled by Default** | Never auto-enable TX or transmission features |
| **Preserve Existing Drivers** | Do not overwrite existing SDR drivers |
| **Explicit Permission Changes** | Do not change kernel, udev, or permissions without confirmation |
| **Verify Before Assume** | Prefer verification over assumption at every step |

**Stop Condition:** If any step would violate system stability, STOP immediately and report the issue before proceeding.

---

## Phase 1 — System Verification (Read-Only)

This phase performs read-only verification of the target system. No modifications are made during this phase.

### 1.1 Operating System Verification

Execute the following commands to verify the operating system:

```bash
# Check OS version
cat /etc/os-release

# Check kernel version
uname -r

# Check system architecture
uname -m
```

**Expected Results:**

| Check | Minimum Requirement |
|-------|---------------------|
| OS | Ubuntu 20.04+ or Debian 11+ |
| Kernel | 5.4+ |
| Architecture | x86_64 or aarch64 |

### 1.2 Node.js Environment Verification

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check pnpm availability (preferred)
pnpm --version
```

**Expected Results:**

| Component | Minimum Version |
|-----------|-----------------|
| Node.js | 18.0.0+ |
| npm | 8.0.0+ |
| pnpm | 8.0.0+ (preferred) |

### 1.3 SoapySDR Installation Verification

```bash
# Check SoapySDR installation
SoapySDRUtil --info

# List available SoapySDR modules
SoapySDRUtil --find

# Check UHD installation (for Ettus devices)
uhd_find_devices
```

**Expected Results:**

The system should report either:
- SoapySDR with available modules (hardware mode), OR
- No devices found (simulator mode will be used)

**Note:** Missing SoapySDR or UHD is acceptable—the application will operate in simulator mode.

### 1.4 User Permissions Verification

```bash
# Check current user
whoami

# Check group memberships
groups

# Check USB device permissions (if hardware present)
ls -la /dev/bus/usb/
```

**Expected Results:**

| Check | Requirement |
|-------|-------------|
| User | Non-root user preferred |
| Groups | `plugdev` or `usrp` group membership for hardware access |
| USB Access | Read/write access to USB devices (if hardware present) |

### 1.5 Verification Report

Before proceeding to Phase 2, document all findings in the following format:

```
=== PHASE 1 VERIFICATION REPORT ===
Date: [YYYY-MM-DD HH:MM]
Operator: [Name]

OS Version: [Result]
Node.js Version: [Result]
pnpm Version: [Result]
SoapySDR Status: [Installed/Not Installed]
UHD Status: [Installed/Not Installed]
Hardware Detected: [Yes/No - List devices]
User: [Username]
Groups: [Group list]

Proceed to Phase 2: [YES/NO]
Blockers: [List any issues]
===================================
```

---

## Phase 2 — Dependency Installation

This phase installs project-local dependencies only. No global packages are installed unless absolutely unavoidable.

### 2.1 Clone Repository

```bash
# Clone the repository
git clone https://github.com/cvalentine99/SDRAPP.git
cd SDRAPP

# Verify repository integrity
git status
git log --oneline -5
```

### 2.2 Install Node.js Dependencies

```bash
# Install dependencies using pnpm (preferred)
pnpm install

# Alternative: npm
npm install
```

**Important Rules:**

| Rule | Implementation |
|------|----------------|
| Local Installation | All packages install to `node_modules/` |
| No Global Packages | Do not use `-g` flag |
| Lock File Respect | Use existing `pnpm-lock.yaml` or `package-lock.json` |
| No Driver Changes | Do not upgrade or remove existing SDR drivers |

### 2.3 Native Module Build Dependencies

If native modules require compilation, install build tools locally:

```bash
# Check if build tools are available
gcc --version
g++ --version
make --version

# If missing (Ubuntu/Debian):
sudo apt-get install build-essential
```

**Note:** This is the only step that may require sudo. Confirm before executing.

### 2.4 Environment Configuration

Create the environment configuration file:

```bash
# Copy example environment file
cp .env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | Required |
| `JWT_SECRET` | Session signing secret | Required |
| `SDR_MODE` | Operating mode | `simulator` |
| `TX_ENABLED` | Transmission enabled | `false` |
| `MAX_SAMPLE_RATE` | Maximum sample rate (Hz) | `56000000` |
| `MAX_GAIN` | Maximum gain (dB) | `76` |

### 2.5 Installation Verification

```bash
# Verify node_modules exists
ls -la node_modules/

# Verify no global packages were installed
npm list -g --depth=0

# Check for any installation warnings
pnpm install --dry-run
```

---

## Phase 3 — Application Build

This phase builds the frontend and backend components without starting any services.

### 3.1 Frontend Build

```bash
# Build the React frontend
pnpm build:client

# Alternative command
cd client && pnpm build
```

**Verification:**

```bash
# Check build output exists
ls -la client/dist/

# Verify index.html
cat client/dist/index.html | head -20
```

### 3.2 Backend Build

```bash
# Build the Node.js backend
pnpm build:server

# Alternative command
cd server && pnpm build
```

**Verification:**

```bash
# Check build output
ls -la dist/

# Verify main entry point
ls -la dist/server/
```

### 3.3 Native Bindings Build (If Required)

If the application includes native SoapySDR bindings:

```bash
# Build native modules
pnpm build:native

# Verify native module
ls -la build/Release/
```

### 3.4 Build Verification Checklist

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Frontend Build | `ls client/dist/index.html` | File exists |
| Backend Build | `ls dist/server/index.js` | File exists |
| No Build Errors | Review build output | Zero errors |
| Simulator Fallback | Check source | Fallback code present |

---

## Phase 4 — Safe Startup

This phase starts the application in SAFE MODE with all protective measures enabled.

### 4.1 Pre-Startup Configuration Verification

Before starting, verify the following safety settings in your `.env` file:

```bash
# Verify safety settings
grep -E "TX_ENABLED|SDR_MODE|MAX_" .env
```

**Required Safe Mode Settings:**

| Setting | Value | Purpose |
|---------|-------|---------|
| `TX_ENABLED` | `false` | Disable all transmission |
| `SDR_MODE` | `simulator` | Start in simulator mode |
| `AUTO_CONNECT` | `false` | No automatic device connection |
| `AUTO_STREAM` | `false` | No automatic streaming |

### 4.2 Database Migration

```bash
# Run database migrations
pnpm db:push

# Verify database connection
pnpm db:studio
```

### 4.3 Start Application

```bash
# Start in production mode
pnpm start

# Alternative: Start with explicit safe mode
NODE_ENV=production TX_ENABLED=false pnpm start
```

### 4.4 Startup Verification

Verify the application started correctly:

```bash
# Check process is running
ps aux | grep node

# Check API health
curl http://localhost:3000/api/health

# Check UI loads
curl -I http://localhost:3000/
```

**Expected API Response:**

```json
{
  "status": "healthy",
  "mode": "simulator",
  "txEnabled": false,
  "version": "1.0.0"
}
```

### 4.5 Functional Verification

| Test | Method | Expected Result |
|------|--------|-----------------|
| API Responds | `curl /api/health` | 200 OK |
| UI Loads | Browser access | React app renders |
| Device List | UI Device page | Shows simulator or hardware |
| No RF Activity | RF monitor | Zero emissions |
| TX Disabled | Policy check | TX button disabled |

### 4.6 Safe Startup Confirmation

Document the startup results:

```
=== PHASE 4 STARTUP REPORT ===
Date: [YYYY-MM-DD HH:MM]
Operator: [Name]

Application Status: [Running/Failed]
API Health: [Healthy/Unhealthy]
UI Status: [Loading/Error]
Mode: [Simulator/Hardware]
TX Status: [Disabled/Enabled]
RF Activity: [None/Detected]

Safe Startup Confirmed: [YES/NO]
Issues: [List any problems]
==============================
```

---

## Phase 5 — Optional Hardware Enablement

**Warning:** This phase should ONLY be executed if explicitly requested and after completing all previous phases successfully.

### 5.1 Hardware Presence Verification

```bash
# Verify hardware is physically connected
lsusb | grep -i "ettus\|usrp\|sdr"

# Check SoapySDR device enumeration
SoapySDRUtil --find

# Check UHD device enumeration
uhd_find_devices
```

**Expected Output Example:**

```
Found device 0
  driver = uhd
  type = b210
  serial = 12345678
```

### 5.2 RX-Only Operation Test

Before enabling any transmission, verify receive-only operation:

```bash
# Update environment for hardware mode
echo "SDR_MODE=hardware" >> .env

# Restart application
pnpm restart
```

**Verification Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Connect to device | Device status shows "Connected" |
| 2 | Configure RX | Frequency/gain/sample rate applied |
| 3 | Start RX stream | Spectrum display shows signal |
| 4 | Verify no TX | TX controls remain disabled |

### 5.3 TX Enablement (Administrative Only)

**Critical Warning:** TX enablement requires:
- Administrative authorization
- Regulatory compliance verification
- RF safety assessment
- Explicit policy update

To enable TX (admin only):

```bash
# Update policy (requires admin credentials)
curl -X POST http://localhost:3000/api/admin/policy \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"txEnabled": true}'
```

**TX Enablement Checklist:**

| Requirement | Verified |
|-------------|----------|
| Administrative authorization | ☐ |
| Regulatory compliance (FCC/local) | ☐ |
| RF safety assessment complete | ☐ |
| Antenna properly connected | ☐ |
| Frequency allocation verified | ☐ |
| Power levels within limits | ☐ |

---

## Stop Conditions

**STOP IMMEDIATELY** if any of the following conditions occur:

| Condition | Action |
|-----------|--------|
| Root access required unexpectedly | Stop, investigate, report |
| Kernel or driver changes suggested | Stop, do not proceed |
| RF transmission would occur by default | Stop, verify configuration |
| Hardware capabilities assumed | Stop, verify with actual query |
| System instability detected | Stop, restore from backup |
| Unknown error during startup | Stop, check logs, report |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "SoapySDR not found" | Not installed | Use simulator mode |
| "Permission denied" on USB | Missing group membership | Add user to `plugdev` group |
| "Port 3000 in use" | Another process | Kill process or change port |
| "Database connection failed" | Invalid DATABASE_URL | Verify connection string |
| "Build failed" | Missing dependencies | Run `pnpm install` again |

### Log Locations

| Log | Location |
|-----|----------|
| Application | `./logs/app.log` |
| SDR Control Plane | `./logs/sdr.log` |
| Audit Log | `./logs/audit.log` |
| System | `/var/log/syslog` |

---

## Support

For deployment assistance:
- GitHub Issues: https://github.com/cvalentine99/SDRAPP/issues
- Documentation: https://github.com/cvalentine99/SDRAPP/wiki

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-06 | Manus AI | Initial deployment guide |
