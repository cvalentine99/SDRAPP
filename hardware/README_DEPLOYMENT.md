# Ettus B210 SDR - Deployment Package

**Version:** 1.0  
**Date:** December 24, 2025  
**Target:** gx10-alpha ARM64 bare metal server

---

## Package Contents

This deployment package contains everything needed to deploy C++ hardware daemons for the Ettus B210 USRP on your gx10-alpha ARM64 server.

### 📁 Directory Structure

```
hardware/
├── src/                              # C++ source files
│   ├── sdr_streamer.cpp             # Real-time FFT streaming daemon
│   ├── freq_scanner.cpp             # Frequency range scanner
│   └── iq_recorder.cpp              # IQ sample recorder
├── CMakeLists.txt                    # Build configuration
├── deploy_to_gx10.sh                # Automated deployment script ⭐
├── remote_compile.sh                # Remote compilation script ⭐
├── install_dependencies.sh          # Dependency installer
├── verify_build.sh                  # Build verification script
├── test_deployment.sh               # Local deployment test
├── QUICKSTART.md                    # Quick start guide (5 min read) 📖
├── DEPLOYMENT_GUIDE.md              # Comprehensive guide (15 min read)
├── DEPLOYMENT_WALKTHROUGH.md        # Step-by-step walkthrough (20 min read) ⭐
├── TROUBLESHOOTING.md               # Troubleshooting guide (reference)
├── VERIFICATION_CHECKLIST.md        # Post-deployment checklist ✅
└── README_DEPLOYMENT.md             # This file

⭐ = Start here
📖 = Essential reading
✅ = Use after deployment
```

---

## Quick Start (5 Minutes)

### Prerequisites
- Ettus B210 USRP hardware
- SSH access to gx10-alpha
- USB 3.0 cable
- 40-60 minutes for full deployment

### Step 1: Test Package Locally
```bash
cd hardware/
./test_deployment.sh
```

**Expected:** All tests pass ✅

### Step 2: Deploy to gx10-alpha
```bash
./deploy_to_gx10.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware
```

**What this does:**
- Creates tarball of hardware directory
- Transfers to gx10-alpha via SSH
- Extracts and sets permissions
- Verifies installation

**Time:** 2-3 minutes

### Step 3: Install Dependencies
```bash
ssh ubuntu@gx10-alpha
cd ~/ettus-sdr-hardware
./install_dependencies.sh
```

**What this installs:**
- Build tools (gcc, g++, cmake)
- UHD (USRP Hardware Driver) from source
- FFTW3 (FFT library)
- Boost libraries
- USB permissions

**Time:** 10-30 minutes ☕

### Step 4: Compile Binaries
```bash
# Option A: Remote compilation (from local machine)
./remote_compile.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware

# Option B: Manual compilation (on gx10-alpha)
mkdir -p build && cd build
cmake ..
make -j$(nproc)
```

**Time:** 2-5 minutes

### Step 5: Verify Installation
```bash
cd ~/ettus-sdr-hardware
./verify_build.sh
```

**Expected:** All checks pass ✅

### Step 6: Test with Hardware
```bash
# Connect B210 to USB 3.0 port
uhd_find_devices

# Test FFT streaming
cd build/bin
./sdr_streamer --freq 915e6 --rate 10e6 --gain 40
```

**Expected:** JSON streaming at ~60 FPS

---

## Documentation Guide

### 📖 Which Document Should I Read?

**If you want to...**

- **Get started quickly (5 min):**  
  → Read `QUICKSTART.md`

- **Understand the full process (15 min):**  
  → Read `DEPLOYMENT_GUIDE.md`

- **Follow step-by-step instructions (20 min):**  
  → Read `DEPLOYMENT_WALKTHROUGH.md` ⭐ **RECOMMENDED**

- **Troubleshoot issues:**  
  → See `TROUBLESHOOTING.md`

- **Verify deployment:**  
  → Use `VERIFICATION_CHECKLIST.md`

### 📚 Reading Order

**First-time deployment:**
1. `README_DEPLOYMENT.md` (this file) - Overview
2. `DEPLOYMENT_WALKTHROUGH.md` - Step-by-step guide
3. `VERIFICATION_CHECKLIST.md` - Verify everything works

**If you encounter issues:**
4. `TROUBLESHOOTING.md` - Solutions to common problems

**For reference:**
5. `DEPLOYMENT_GUIDE.md` - Comprehensive technical details
6. `QUICKSTART.md` - Quick command reference

---

## Deployment Scripts

### 🚀 deploy_to_gx10.sh

**Purpose:** Automated deployment to gx10-alpha

**Usage:**
```bash
./deploy_to_gx10.sh [USER] [HOST] [PORT] [REMOTE_DIR] [AUTO_COMPILE]
```

**Example:**
```bash
./deploy_to_gx10.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware no
```

**What it does:**
1. Tests SSH connection
2. Creates tarball (excludes build artifacts)
3. Transfers via SCP
4. Extracts on remote server
5. Sets permissions
6. Verifies installation

**Time:** 2-3 minutes

### 🔨 remote_compile.sh

**Purpose:** Remote compilation via SSH

**Usage:**
```bash
./remote_compile.sh [USER] [HOST] [PORT] [REMOTE_DIR]
```

**Example:**
```bash
./remote_compile.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware
```

**What it does:**
1. Checks SSH connection
2. Verifies dependencies
3. Runs CMake configuration
4. Compiles with make -j$(nproc)
5. Verifies binaries

**Time:** 2-5 minutes

### 📦 install_dependencies.sh

**Purpose:** Install all required dependencies

**Usage:**
```bash
# On gx10-alpha
./install_dependencies.sh
```

**What it installs:**
- Build tools (gcc, g++, cmake, git)
- Boost libraries (all components)
- libusb for USB communication
- FFTW3 for FFT computation
- JSON libraries
- **UHD from source** (takes longest)
- USB permissions (udev rules)

**Time:** 10-30 minutes

### ✅ verify_build.sh

**Purpose:** Verify compilation and hardware

**Usage:**
```bash
# On gx10-alpha
./verify_build.sh
```

**What it checks:**
- Build directory exists
- Binaries compiled
- Library dependencies
- Binary execution
- UHD device detection

**Time:** 30 seconds

### 🧪 test_deployment.sh

**Purpose:** Test deployment package locally

**Usage:**
```bash
# On local machine
./test_deployment.sh
```

**What it tests:**
- Scripts exist and are executable
- C++ source files present
- Tarball creation/extraction
- CMakeLists.txt syntax
- Documentation files

**Time:** 10 seconds

---

## System Requirements

### gx10-alpha Server
- **OS:** Ubuntu 20.04+ or Debian 11+ (ARM64)
- **CPU:** ARM64 processor (4+ cores recommended)
- **RAM:** 2 GB minimum, 4 GB recommended
- **Disk:** 5 GB free space
- **USB:** USB 3.0 port (blue colored)
- **Network:** SSH access, internet connection for dependencies

### Local Machine
- **OS:** Linux, macOS, or Windows with WSL
- **Tools:** SSH client, bash shell
- **Network:** SSH access to gx10-alpha

### Hardware
- **Ettus B210 USRP** (70 MHz - 6 GHz transceiver)
- **USB 3.0 cable** (included with B210)
- **Optional:** External clock/GPSDO

---

## Deployment Timeline

**Total Time:** 40-60 minutes (mostly automated)

| Phase | Task | Time | Hands-On |
|-------|------|------|----------|
| 1 | Test package locally | 1 min | Active |
| 2 | Deploy to gx10-alpha | 2 min | Active |
| 3 | Install dependencies | 20 min | ☕ Passive |
| 4 | Compile binaries | 3 min | ☕ Passive |
| 5 | Verify build | 1 min | Active |
| 6 | Connect hardware | 2 min | Active |
| 7 | Test integration | 5 min | Active |
| 8 | Configure web app | 2 min | Active |
| 9 | Final verification | 5 min | Active |
| **Total** | | **41 min** | **18 min active** |

---

## Compiled Binaries

### sdr_streamer

**Purpose:** Real-time FFT streaming daemon

**Usage:**
```bash
sdr_streamer --freq <Hz> --rate <Hz> --gain <dB>
```

**Example:**
```bash
sdr_streamer --freq 915e6 --rate 10e6 --gain 40
```

**Output:** JSON stream at ~60 FPS
```json
{"timestamp":1703462400123,"centerFreq":915000000.0,"sampleRate":10000000.0,"fftSize":2048,"fftData":[-80.5,-78.2,...]}
```

### freq_scanner

**Purpose:** Frequency range scanner with peak detection

**Usage:**
```bash
freq_scanner --start <Hz> --stop <Hz> --step <Hz> --gain <dB>
```

**Example:**
```bash
freq_scanner --start 900e6 --stop 930e6 --step 1e6 --gain 40
```

**Output:** JSON array
```json
[{"frequency":900000000.0,"peakPower":-75.3}, ...]
```

### iq_recorder

**Purpose:** IQ sample recorder with SigMF format

**Usage:**
```bash
iq_recorder --freq <Hz> --rate <Hz> --gain <dB> --duration <sec> --output <file>
```

**Example:**
```bash
iq_recorder --freq 915e6 --rate 10e6 --gain 40 --duration 5 --output recording.sigmf-data
```

**Output:** Binary IQ file + SigMF metadata

---

## Common Issues & Solutions

### Issue: SSH connection fails
**Solution:** See TROUBLESHOOTING.md § "SSH Connection Issues"

### Issue: UHD compilation fails
**Solution:** See TROUBLESHOOTING.md § "Dependency Installation Problems"

### Issue: B210 not detected
**Solution:** See TROUBLESHOOTING.md § "B210 Device Not Detected"

### Issue: Compilation errors
**Solution:** See TROUBLESHOOTING.md § "Compilation Errors"

### Issue: Runtime errors
**Solution:** See TROUBLESHOOTING.md § "Runtime Errors"

### Issue: Web app integration fails
**Solution:** See TROUBLESHOOTING.md § "Web Application Integration Issues"

**For all issues:** See `TROUBLESHOOTING.md` for comprehensive solutions.

---

## Support & Resources

### Documentation
- `QUICKSTART.md` - Quick start guide
- `DEPLOYMENT_GUIDE.md` - Comprehensive deployment guide
- `DEPLOYMENT_WALKTHROUGH.md` - Step-by-step walkthrough
- `TROUBLESHOOTING.md` - Troubleshooting guide
- `VERIFICATION_CHECKLIST.md` - Post-deployment checklist

### External Resources
- **Ettus Knowledge Base:** https://kb.ettus.com/
- **UHD Manual:** https://files.ettus.com/manual/
- **Ettus Forums:** https://forums.ettus.com/
- **B210 Product Page:** https://www.ettus.com/all-products/ub200-kit/

### Getting Help
1. Check `TROUBLESHOOTING.md` first
2. Search Ettus Knowledge Base
3. Post on Ettus forums with diagnostics
4. Contact Ettus support: support@ettus.com

---

## Version History

**v1.0 (December 24, 2025)**
- Initial release
- Automated deployment scripts
- Comprehensive documentation
- ARM64 optimization
- UHD 4.6.0.0 support

---

## License

This deployment package is part of the Ettus B210 SDR Web Application project.

**Hardware Daemons:** MIT License  
**UHD Library:** GPL v3  
**FFTW3 Library:** GPL v2+

See individual component licenses for details.

---

## Quick Reference Card

### Essential Commands

```bash
# Test package
./test_deployment.sh

# Deploy
./deploy_to_gx10.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware

# Install dependencies (on gx10-alpha)
./install_dependencies.sh

# Compile remotely
./remote_compile.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware

# Verify
./verify_build.sh

# Find device
uhd_find_devices

# Test streaming
sdr_streamer --freq 915e6 --rate 10e6 --gain 40
```

### Key Files

- **Start here:** `DEPLOYMENT_WALKTHROUGH.md`
- **Quick ref:** `QUICKSTART.md`
- **Problems?:** `TROUBLESHOOTING.md`
- **Verify:** `VERIFICATION_CHECKLIST.md`

### Support

- Documentation: See `hardware/` directory
- Ettus KB: https://kb.ettus.com/
- Forums: https://forums.ettus.com/

---

**Ready to deploy?** Start with `DEPLOYMENT_WALKTHROUGH.md` for step-by-step instructions!

**Questions?** See `TROUBLESHOOTING.md` or contact support.

**Good luck! 🚀**
