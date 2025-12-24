# Production Deployment Guide - Ettus B210 SDR Web Application

## Prerequisites

- **Hardware**: Ettus B210 USRP with GPSDO
- **Target System**: gx10-alpha ARM64 bare metal server
- **OS**: Ubuntu 22.04 or later
- **Node.js**: v22.13.0 or later
- **Database**: MySQL/TiDB (provided by Manus platform)
- **UHD**: Pre-compiled binaries included in `hardware/bin/`

## Quick Deployment Checklist

- [ ] Clone repository to gx10-alpha
- [ ] Install Node.js and pnpm
- [ ] Configure environment variables
- [ ] Build C++ hardware daemons
- [ ] Verify B210 hardware connection
- [ ] Install dependencies and build frontend
- [ ] Configure systemd services
- [ ] Test production mode
- [ ] Enable auto-start on boot

## Step 1: System Preparation

```bash
# SSH to gx10-alpha
ssh user@gx10-alpha

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install build dependencies for C++ daemons
sudo apt install -y build-essential cmake libboost-all-dev libfftw3-dev
```

## Step 2: Clone and Configure

```bash
# Clone repository
cd /opt
sudo git clone <repository-url> ettus-sdr-web
sudo chown -R $USER:$USER ettus-sdr-web
cd ettus-sdr-web

# Install Node.js dependencies
pnpm install

# Create .env file
cp .env.example .env
nano .env
```

### Environment Variables Configuration

```bash
# .env file
NODE_ENV=production
PORT=3000

# SDR Mode (demo or production)
SDR_MODE=production

# Database (provided by Manus platform)
DATABASE_URL=mysql://user:password@host:port/database

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-generated-secret-here

# OAuth Configuration (provided by Manus platform)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://login.manus.im
VITE_APP_ID=your-app-id

# Owner Information
OWNER_OPEN_ID=your-open-id
OWNER_NAME=your-name

# Manus Built-in APIs
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-forge-api-key
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im

# Analytics
VITE_ANALYTICS_ENDPOINT=https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID=your-website-id

# App Branding
VITE_APP_TITLE=Ettus B210 SDR
VITE_APP_LOGO=/logo.png
```

## Step 3: Build C++ Hardware Daemons

```bash
# Navigate to hardware directory
cd hardware

# Create build directory
mkdir -p build
cd build

# Configure with CMake
cmake ..

# Build all daemons (sdr_streamer, iq_recorder, freq_scanner)
make -j$(nproc)

# Verify binaries
ls -lh sdr_streamer iq_recorder freq_scanner

# Test sdr_streamer (requires B210 connected)
./sdr_streamer --freq 915e6 --rate 10e6 --gain 50 --duration 5
```

## Step 4: Verify B210 Hardware

```bash
# Run hardware verification script
cd /opt/ettus-sdr-web/hardware
./verify_b210.sh

# Expected output:
# ✓ B210 device found
# ✓ Serial: 194919
# ✓ Name: MyB210
# ✓ FW Version: 8.0
# ✓ FPGA Version: 16.0
# ✓ GPSDO: GPSTCXO v3.2
```

## Step 5: Build Frontend

```bash
cd /opt/ettus-sdr-web

# Build production frontend
pnpm run build

# Verify build output
ls -lh client/dist/
```

## Step 6: Database Migration

```bash
# Push database schema
pnpm db:push

# Verify tables created
# (Use database management UI or MySQL client)
```

## Step 7: Create Systemd Service

```bash
# Create service file
sudo nano /etc/systemd/system/ettus-sdr-web.service
```

### Service File Content

```ini
[Unit]
Description=Ettus B210 SDR Web Application
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/ettus-sdr-web
Environment="NODE_ENV=production"
Environment="SDR_MODE=production"
EnvironmentFile=/opt/ettus-sdr-web/.env
ExecStart=/usr/bin/node server/_core/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ettus-sdr-web

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (auto-start on boot)
sudo systemctl enable ettus-sdr-web

# Start service
sudo systemctl start ettus-sdr-web

# Check status
sudo systemctl status ettus-sdr-web

# View logs
sudo journalctl -u ettus-sdr-web -f
```

## Step 8: Configure Reverse Proxy (Optional)

If deploying behind nginx or Apache:

```nginx
# /etc/nginx/sites-available/ettus-sdr-web
server {
    listen 80;
    server_name sdr.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for FFT streaming
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/ettus-sdr-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Step 9: Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application port (if not using reverse proxy)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
```

## Step 10: Production Testing

### Test Checklist

- [ ] Access web interface at `http://gx10-alpha:3000`
- [ ] Verify device info in footer shows real B210 data
- [ ] Switch to Production mode in Settings
- [ ] Test Spectrum page - verify FFT streaming works
- [ ] Test Scanner page - scan 900-930 MHz range
- [ ] Test Device page - adjust gain, frequency
- [ ] Test Recording page - record IQ samples
- [ ] Test Telemetry page - verify hardware metrics
- [ ] Verify WebSocket connection stability
- [ ] Check system logs for errors

### Performance Verification

```bash
# Monitor CPU/Memory usage
htop

# Check WebSocket connections
ss -tan | grep :3000

# Monitor FFT streaming performance
sudo journalctl -u ettus-sdr-web -f | grep "FFT"

# Check B210 USB connection
lsusb | grep Ettus
```

## Backup and Recovery

### Backup

```bash
# Backup database
mysqldump -h <host> -u <user> -p <database> > backup_$(date +%Y%m%d).sql

# Backup application files
tar -czf ettus-sdr-web-backup_$(date +%Y%m%d).tar.gz /opt/ettus-sdr-web

# Backup environment variables
cp /opt/ettus-sdr-web/.env /opt/ettus-sdr-web/.env.backup
```

### Recovery

```bash
# Restore database
mysql -h <host> -u <user> -p <database> < backup_20251224.sql

# Restore application files
tar -xzf ettus-sdr-web-backup_20251224.tar.gz -C /

# Restart service
sudo systemctl restart ettus-sdr-web
```

## Monitoring and Maintenance

### Log Locations

- **Application logs**: `sudo journalctl -u ettus-sdr-web`
- **System logs**: `/var/log/syslog`
- **Nginx logs**: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`

### Health Checks

```bash
# Check service status
sudo systemctl status ettus-sdr-web

# Check B210 connection
cd /opt/ettus-sdr-web/hardware
./verify_b210.sh

# Check disk space
df -h

# Check memory usage
free -h

# Check network connections
netstat -tulpn | grep 3000
```

### Updates

```bash
# Pull latest code
cd /opt/ettus-sdr-web
git pull origin main

# Install dependencies
pnpm install

# Rebuild C++ daemons
cd hardware/build
make -j$(nproc)

# Rebuild frontend
cd ../..
pnpm run build

# Restart service
sudo systemctl restart ettus-sdr-web
```

## Troubleshooting

### B210 Not Detected

```bash
# Check USB connection
lsusb | grep Ettus

# Check UHD can find device
cd /opt/ettus-sdr-web/hardware/bin
./uhd_find_devices

# Check permissions
sudo usermod -aG plugdev $USER
# Logout and login again
```

### WebSocket Connection Fails

```bash
# Check if WebSocket server is running
sudo netstat -tulpn | grep 3000

# Check firewall
sudo ufw status

# Check nginx WebSocket configuration
sudo nginx -t
```

### High CPU Usage

```bash
# Check if multiple sdr_streamer processes are running
ps aux | grep sdr_streamer

# Kill zombie processes
pkill -9 sdr_streamer

# Restart service
sudo systemctl restart ettus-sdr-web
```

### Database Connection Errors

```bash
# Test database connection
mysql -h <host> -u <user> -p <database>

# Check DATABASE_URL in .env
cat /opt/ettus-sdr-web/.env | grep DATABASE_URL

# Verify database tables exist
pnpm db:push
```

## Security Considerations

1. **Change default credentials**: Update JWT_SECRET and database passwords
2. **Enable HTTPS**: Use Let's Encrypt for SSL certificates
3. **Firewall rules**: Only expose necessary ports
4. **Regular updates**: Keep system packages and dependencies updated
5. **Access control**: Implement IP whitelisting if needed
6. **Backup encryption**: Encrypt sensitive backup files
7. **Log monitoring**: Set up alerts for suspicious activity

## Performance Tuning

### Node.js Optimization

```bash
# Increase memory limit if needed
Environment="NODE_OPTIONS=--max-old-space-size=4096"
```

### Database Optimization

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_created_at ON recordings(created_at);
```

### WebSocket Optimization

```javascript
// Adjust FFT streaming rate if needed
// In demo-hardware-manager.ts or production-hardware-manager.ts
const FFT_RATE = 30; // Reduce from 60 FPS to 30 FPS if bandwidth limited
```

## Support and Documentation

- **Project Documentation**: See README.md
- **Hardware Guide**: See DEPLOYMENT-GX10-ALPHA.md
- **Build Instructions**: See hardware/BUILD_INSTRUCTIONS.md
- **UHD Tools**: See hardware/bin/README.md
- **Issue Tracker**: <repository-url>/issues

## Deployment Verification

After completing all steps, verify:

✓ Service is running: `sudo systemctl status ettus-sdr-web`  
✓ B210 is detected: `./hardware/verify_b210.sh`  
✓ Web interface is accessible: `http://gx10-alpha:3000`  
✓ Production mode is active: Check Settings page  
✓ FFT streaming works: Open Spectrum page  
✓ Scanner works: Scan 900-930 MHz  
✓ Logs are clean: `sudo journalctl -u ettus-sdr-web -n 100`  

**Deployment complete! 🎉**
