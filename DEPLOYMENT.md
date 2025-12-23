# Deployment Guide - ARM64 Bare Metal (gx10-alpha)

Complete guide for deploying the Ettus SDR Web Application to ARM64 bare metal server with CUDA support.

## System Requirements

- **OS**: Ubuntu 22.04 LTS (ARM64)
- **CPU**: ARM64 with 4+ cores
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 20GB free space
- **USB**: USB 3.0 port for Ettus B210
- **Network**: Static IP or DDNS for remote access

## Pre-Deployment Checklist

- [ ] Ubuntu 22.04 ARM64 installed and updated
- [ ] Static IP configured or DDNS set up
- [ ] SSH access configured
- [ ] Sudo privileges available
- [ ] Ettus B210 hardware available for testing
- [ ] Firewall rules configured (ports 80, 443, 3000)

---

## Step 1: System Setup

### Update System
```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y curl git build-essential
```

### Install Node.js 22.x (ARM64)
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should show v22.x.x
```

### Install pnpm
```bash
sudo npm install -g pnpm
pnpm --version
```

### Install MySQL/TiDB Client
```bash
sudo apt-get install -y mysql-client
```

---

## Step 2: UHD and Dependencies

### Install UHD Library
```bash
sudo apt-get install -y libuhd-dev uhd-host
sudo uhd_images_downloader
```

### Install FFTW3
```bash
sudo apt-get install -y libfftw3-dev libfftw3-single3
```

### Install CMake and Build Tools
```bash
sudo apt-get install -y cmake pkg-config
```

### Verify UHD Installation
```bash
uhd_find_devices
# Should detect B210 if plugged in
```

---

## Step 3: Clone and Build

### Clone Repository
```bash
cd /opt
sudo git clone <your-repo-url> ettus-sdr-web
sudo chown -R $USER:$USER ettus-sdr-web
cd ettus-sdr-web
```

### Install Node.js Dependencies
```bash
pnpm install
```

### Build C++ Streaming Daemon
```bash
cd hardware
mkdir -p build
cd build
cmake ..
make -j$(nproc)
sudo make install
cd ../..
```

### Verify Binary
```bash
which sdr_streamer
# Should output: /usr/local/bin/sdr_streamer

# Test with hardware
sdr_streamer --freq 915 --rate 10 --gain 50
# Press Ctrl+C to stop
```

---

## Step 4: Database Setup

### Connect to TiDB/MySQL
```bash
mysql -h <your-tidb-host> -u <username> -p
```

### Run Migrations
```bash
pnpm db:push
```

### Verify Tables
```bash
mysql -h <your-tidb-host> -u <username> -p -e "SHOW TABLES;" <database-name>
```

---

## Step 5: Environment Configuration

### Create Production .env
```bash
cat > .env.production << 'EOF'
# Database
DATABASE_URL=mysql://user:password@host:4000/database?ssl={"rejectUnauthorized":true}

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=<your-secret-here>

# OAuth (from Manus platform)
VITE_APP_ID=<app-id>
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://auth.manus.im

# Owner Info
OWNER_OPEN_ID=<your-open-id>
OWNER_NAME=<your-name>

# Manus APIs
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=<your-api-key>
VITE_FRONTEND_FORGE_API_KEY=<frontend-api-key>
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

# Analytics
VITE_ANALYTICS_ENDPOINT=https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID=<website-id>

# App Branding
VITE_APP_TITLE=Ettus SDR Web
VITE_APP_LOGO=https://your-logo-url.com/logo.png

# Node Environment
NODE_ENV=production
EOF
```

### Set Permissions
```bash
chmod 600 .env.production
```

---

## Step 6: Build Production Assets

### Build Frontend
```bash
pnpm build
```

### Verify Build
```bash
ls -lh client/dist/
# Should see index.html, assets/, etc.
```

---

## Step 7: Systemd Service Setup

### Create Service File
```bash
sudo tee /etc/systemd/system/ettus-sdr-web.service > /dev/null << 'EOF'
[Unit]
Description=Ettus SDR Web Application
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/opt/ettus-sdr-web
Environment="NODE_ENV=production"
EnvironmentFile=/opt/ettus-sdr-web/.env.production
ExecStart=/usr/bin/node server/_core/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Resource Limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
```

### Enable and Start Service
```bash
sudo systemctl daemon-reload
sudo systemctl enable ettus-sdr-web
sudo systemctl start ettus-sdr-web
sudo systemctl status ettus-sdr-web
```

### View Logs
```bash
sudo journalctl -u ettus-sdr-web -f
```

---

## Step 8: Nginx Reverse Proxy (Optional but Recommended)

### Install Nginx
```bash
sudo apt-get install -y nginx
```

### Configure Nginx
```bash
sudo tee /etc/nginx/sites-available/ettus-sdr-web > /dev/null << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Support
    location /api/ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Static Assets Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/ettus-sdr-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Install SSL Certificate (Let's Encrypt)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Step 9: Firewall Configuration

### UFW (Ubuntu Firewall)
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

---

## Step 10: USB Permissions for B210

### Add User to USB Group
```bash
sudo usermod -a -G usb ubuntu
```

### Create udev Rule
```bash
sudo tee /etc/udev/rules.d/99-ettus-b210.rules > /dev/null << 'EOF'
# Ettus B210 USRP
SUBSYSTEM=="usb", ATTR{idVendor}=="2500", ATTR{idProduct}=="0020", MODE="0666", GROUP="usb"
EOF
```

### Reload udev Rules
```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
```

### Verify Permissions
```bash
lsusb | grep Ettus
# Should show: Bus XXX Device XXX: ID 2500:0020 Ettus Research LLC USRP B200
```

---

## Step 11: Performance Tuning (ARM64)

### CPU Governor
```bash
# Set to performance mode
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Make persistent
sudo tee /etc/rc.local > /dev/null << 'EOF'
#!/bin/bash
echo performance > /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
exit 0
EOF

sudo chmod +x /etc/rc.local
```

### USB Buffer Size
```bash
echo 128 | sudo tee /sys/module/usbcore/parameters/usbfs_memory_mb

# Make persistent
echo "options usbcore usbfs_memory_mb=128" | sudo tee /etc/modprobe.d/usb-buffer.conf
```

### Swap Configuration (if RAM < 16GB)
```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Step 12: Monitoring and Maintenance

### Log Rotation
```bash
sudo tee /etc/logrotate.d/ettus-sdr-web > /dev/null << 'EOF'
/var/log/ettus-sdr-web/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        systemctl reload ettus-sdr-web > /dev/null 2>&1 || true
    endscript
}
EOF
```

### Health Check Script
```bash
cat > /opt/ettus-sdr-web/health-check.sh << 'EOF'
#!/bin/bash
if ! systemctl is-active --quiet ettus-sdr-web; then
    echo "Service down, restarting..."
    sudo systemctl restart ettus-sdr-web
fi
EOF

chmod +x /opt/ettus-sdr-web/health-check.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/ettus-sdr-web/health-check.sh") | crontab -
```

---

## Step 13: Testing

### Test Hardware Connection
```bash
sdr_streamer --freq 915 --rate 10 --gain 50
# Should output JSON FFT data
# Press Ctrl+C to stop
```

### Test Web Application
```bash
curl http://localhost:3000
# Should return HTML

curl http://localhost:3000/api/health
# Should return {"status":"ok"}
```

### Test WebSocket
```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000/api/ws

# Send subscribe message
{"type":"subscribe"}

# Should receive FFT data frames
```

---

## Troubleshooting

### Service Won't Start
```bash
sudo journalctl -u ettus-sdr-web -n 100 --no-pager
```

### Database Connection Errors
```bash
mysql -h <host> -u <user> -p -e "SELECT 1;"
```

### Hardware Not Detected
```bash
lsusb | grep Ettus
uhd_find_devices
sudo dmesg | grep usb
```

### High CPU Usage
```bash
top
htop
# Check sdr_streamer process
# Reduce sample rate if needed
```

---

## Backup and Recovery

### Backup Database
```bash
mysqldump -h <host> -u <user> -p <database> > backup.sql
```

### Backup Application
```bash
cd /opt
sudo tar -czf ettus-sdr-web-backup-$(date +%Y%m%d).tar.gz ettus-sdr-web/
```

### Restore
```bash
cd /opt
sudo tar -xzf ettus-sdr-web-backup-YYYYMMDD.tar.gz
sudo systemctl restart ettus-sdr-web
```

---

## Security Hardening

### Disable Root SSH
```bash
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### Enable Automatic Security Updates
```bash
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### Fail2Ban (SSH Protection)
```bash
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Support

For issues specific to:
- **UHD/Hardware**: https://github.com/EttusResearch/uhd
- **Application**: Check logs with `sudo journalctl -u ettus-sdr-web -f`
- **Manus Platform**: https://help.manus.im

---

## License

Ensure compliance with:
- UHD (GPL v3)
- FFTW3 (GPL v2+)
- Node.js dependencies (various licenses)
