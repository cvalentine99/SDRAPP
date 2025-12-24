# Ettus B210 SDR Web Application - Deployment Package

## Package Contents

```
ettus-sdr-web/
├── install.sh                      # Automated installation script
├── DEPLOYMENT_README.md            # This file
├── PRODUCTION_DEPLOYMENT.md        # Detailed deployment guide
├── docs/
│   └── ARCHITECTURE.md             # System architecture diagrams
├── hardware/
│   ├── src/                        # C++ daemon source code
│   ├── CMakeLists.txt              # Build configuration
│   ├── verify_b210.sh              # Hardware verification script
│   ├── BUILD_INSTRUCTIONS.md       # Manual build guide
│   └── bin/                        # Pre-compiled UHD tools
├── server/                         # Node.js backend
├── client/                         # React frontend
├── drizzle/                        # Database schema
└── package.json                    # Node.js dependencies
```

## Quick Start Installation

### Prerequisites

- **Hardware**: gx10-alpha (ARM64) with Ettus B210 connected via USB 3.0
- **OS**: Ubuntu 22.04 LTS (ARM64)
- **Network**: Internet connection for package downloads
- **Permissions**: Root access (sudo)

### Installation Steps

1. **Transfer package to gx10-alpha:**
   ```bash
   scp -r ettus-sdr-web/ user@gx10-alpha:/tmp/
   ```

2. **SSH to gx10-alpha:**
   ```bash
   ssh user@gx10-alpha
   ```

3. **Run automated installer:**
   ```bash
   cd /tmp/ettus-sdr-web
   sudo ./install.sh
   ```

4. **Configure environment variables:**
   ```bash
   sudo nano /opt/ettus-sdr-web/.env
   ```
   
   Add the following (replace with your values):
   ```env
   # Database
   DATABASE_URL="mysql://user:password@localhost:3306/ettus_sdr"
   
   # JWT Secret (generate with: openssl rand -base64 32)
   JWT_SECRET="your-secret-key-here"
   
   # Manus OAuth (if using)
   VITE_APP_ID="your-app-id"
   OAUTH_SERVER_URL="https://api.manus.im"
   VITE_OAUTH_PORTAL_URL="https://portal.manus.im"
   
   # SDR Mode (demo or production)
   SDR_MODE="production"
   ```

5. **Verify B210 hardware:**
   ```bash
   /opt/ettus-sdr-web/hardware/verify_b210.sh
   ```
   
   Expected output:
   ```
   ✓ B210 device detected
   ✓ Serial: 194919
   ✓ GPSDO: GPSTCXO v3.2
   ✓ USB 3.0 connection
   ```

6. **Start the service:**
   ```bash
   sudo systemctl start ettus-sdr-web
   ```

7. **Check service status:**
   ```bash
   sudo systemctl status ettus-sdr-web
   ```

8. **Access the application:**
   ```
   http://<gx10-alpha-ip-address>
   ```

## Post-Installation Checklist

- [ ] Service is running: `systemctl status ettus-sdr-web`
- [ ] Nginx is running: `systemctl status nginx`
- [ ] B210 is detected: `uhd_find_devices`
- [ ] Database connection works
- [ ] Web interface is accessible
- [ ] FFT streaming works (click START button)
- [ ] Frequency tuning works
- [ ] Recording feature works
- [ ] Scanner feature works

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u ettus-sdr-web -n 50

# Common issues:
# - Missing .env file
# - Database connection failed
# - Port 3000 already in use
```

### B210 not detected

```bash
# Check USB connection
lsusb | grep Ettus

# Check UHD installation
uhd_find_devices

# Check permissions
sudo usermod -aG usb $USER
```

### FFT streaming not working

```bash
# Check if sdr_streamer is running
ps aux | grep sdr_streamer

# Test manually
cd /opt/ettus-sdr-web/hardware/build
./sdr_streamer --freq 915e6 --rate 10e6 --gain 50

# Check hardware manager logs
sudo journalctl -u ettus-sdr-web | grep "Hardware"
```

### WebSocket connection failed

```bash
# Check nginx configuration
sudo nginx -t

# Check if WebSocket endpoint is accessible
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  http://localhost:3000/ws/fft
```

## Manual Installation (Alternative)

If the automated installer fails, follow the detailed manual installation guide in `PRODUCTION_DEPLOYMENT.md`.

## System Requirements

### Minimum

- **CPU**: ARM64 quad-core @ 1.5 GHz
- **RAM**: 2 GB
- **Storage**: 10 GB
- **USB**: USB 3.0 port
- **Network**: 100 Mbps

### Recommended

- **CPU**: ARM64 octa-core @ 2.0 GHz
- **RAM**: 4 GB
- **Storage**: 50 GB (for recordings)
- **USB**: USB 3.0 port with dedicated controller
- **Network**: 1 Gbps

## Architecture Overview

See `docs/ARCHITECTURE.md` for detailed system architecture diagrams including:

- System component diagram
- Data flow sequence diagram
- Deployment architecture
- Network topology
- Database schema

## Service Management

### Start service
```bash
sudo systemctl start ettus-sdr-web
```

### Stop service
```bash
sudo systemctl stop ettus-sdr-web
```

### Restart service
```bash
sudo systemctl restart ettus-sdr-web
```

### Enable auto-start on boot
```bash
sudo systemctl enable ettus-sdr-web
```

### Disable auto-start
```bash
sudo systemctl disable ettus-sdr-web
```

### View logs
```bash
# Real-time logs
sudo journalctl -u ettus-sdr-web -f

# Last 100 lines
sudo journalctl -u ettus-sdr-web -n 100

# Logs since boot
sudo journalctl -u ettus-sdr-web -b
```

## Backup & Recovery

### Backup recordings
```bash
sudo tar -czf recordings-backup-$(date +%Y%m%d).tar.gz \
  /opt/ettus-sdr-web/recordings/
```

### Backup database
```bash
mysqldump -u user -p ettus_sdr > ettus_sdr_backup.sql
```

### Restore from backup
```bash
# Stop service
sudo systemctl stop ettus-sdr-web

# Restore recordings
sudo tar -xzf recordings-backup-YYYYMMDD.tar.gz -C /

# Restore database
mysql -u user -p ettus_sdr < ettus_sdr_backup.sql

# Start service
sudo systemctl start ettus-sdr-web
```

## Updating the Application

```bash
# Stop service
sudo systemctl stop ettus-sdr-web

# Backup current installation
sudo cp -r /opt/ettus-sdr-web /opt/ettus-sdr-web.backup

# Update files
cd /opt/ettus-sdr-web
sudo git pull  # or copy new files

# Rebuild C++ daemons
cd hardware/build
sudo cmake ..
sudo make -j$(nproc)

# Update Node.js dependencies
cd /opt/ettus-sdr-web
sudo pnpm install --prod

# Restart service
sudo systemctl restart ettus-sdr-web
```

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop ettus-sdr-web
sudo systemctl disable ettus-sdr-web

# Remove service file
sudo rm /etc/systemd/system/ettus-sdr-web.service
sudo systemctl daemon-reload

# Remove nginx configuration
sudo rm /etc/nginx/sites-enabled/ettus-sdr-web
sudo rm /etc/nginx/sites-available/ettus-sdr-web
sudo systemctl reload nginx

# Remove application files
sudo rm -rf /opt/ettus-sdr-web

# (Optional) Remove UHD
sudo apt-get remove --purge uhd-host
```

## Support & Documentation

- **Architecture**: `docs/ARCHITECTURE.md`
- **Deployment Guide**: `PRODUCTION_DEPLOYMENT.md`
- **Build Instructions**: `hardware/BUILD_INSTRUCTIONS.md`
- **Hardware Verification**: `hardware/verify_b210.sh`

## License

© 2025 ETTUS RESEARCH | B210 USRP
