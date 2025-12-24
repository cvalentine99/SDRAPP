#!/bin/bash
#
# Ettus B210 SDR Web Application - Automated Installation Script
# Target: gx10-alpha (ARM64 Ubuntu 22.04)
# Usage: sudo ./install.sh
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/ettus-sdr-web"
SERVICE_NAME="ettus-sdr-web"
NODE_VERSION="22"
UHD_VERSION="4.6.0.0"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Ettus B210 SDR Web Application Installer${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}ERROR: Please run as root (sudo ./install.sh)${NC}"
  exit 1
fi

# Check if running on ARM64
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ]; then
  echo -e "${YELLOW}WARNING: This script is designed for ARM64 architecture. Current: $ARCH${NC}"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo -e "${GREEN}[1/10] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

echo -e "${GREEN}[2/10] Installing system dependencies...${NC}"
apt-get install -y \
  build-essential \
  cmake \
  git \
  curl \
  wget \
  nginx \
  libboost-all-dev \
  libusb-1.0-0-dev \
  libfftw3-dev \
  python3-mako \
  python3-numpy \
  doxygen \
  libgps-dev \
  gpsd \
  gpsd-clients

echo -e "${GREEN}[3/10] Installing Node.js ${NODE_VERSION}...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi

# Install pnpm
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
fi

echo -e "${GREEN}[4/10] Installing UHD ${UHD_VERSION}...${NC}"
if ! command -v uhd_find_devices &> /dev/null; then
  cd /tmp
  wget https://github.com/EttusResearch/uhd/archive/refs/tags/v${UHD_VERSION}.tar.gz
  tar -xzf v${UHD_VERSION}.tar.gz
  cd uhd-${UHD_VERSION}/host
  mkdir -p build
  cd build
  cmake -DCMAKE_INSTALL_PREFIX=/usr/local ..
  make -j$(nproc)
  make install
  ldconfig
  
  # Download UHD FPGA images
  uhd_images_downloader
  
  cd /tmp
  rm -rf uhd-${UHD_VERSION} v${UHD_VERSION}.tar.gz
else
  echo -e "${YELLOW}UHD already installed, skipping...${NC}"
fi

echo -e "${GREEN}[5/10] Creating installation directory...${NC}"
mkdir -p $INSTALL_DIR
mkdir -p $INSTALL_DIR/recordings
mkdir -p $INSTALL_DIR/logs

echo -e "${GREEN}[6/10] Copying application files...${NC}"
# Copy all files from current directory to install directory
cp -r ./* $INSTALL_DIR/
cd $INSTALL_DIR

echo -e "${GREEN}[7/10] Installing Node.js dependencies...${NC}"
pnpm install --prod

echo -e "${GREEN}[8/10] Building C++ daemons...${NC}"
cd $INSTALL_DIR/hardware
mkdir -p build
cd build
cmake ..
make -j$(nproc)

# Verify binaries were built
if [ ! -f "./sdr_streamer" ] || [ ! -f "./iq_recorder" ] || [ ! -f "./freq_scanner" ]; then
  echo -e "${RED}ERROR: C++ daemon compilation failed${NC}"
  exit 1
fi

echo -e "${GREEN}[9/10] Configuring systemd service...${NC}"
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Ettus B210 SDR Web Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/server/_core/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment
Environment="NODE_ENV=production"
Environment="PORT=3000"

# Resource limits
MemoryLimit=1G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}

echo -e "${GREEN}[10/10] Configuring Nginx reverse proxy...${NC}"
cat > /etc/nginx/sites-available/${SERVICE_NAME} <<'EOF'
server {
    listen 80;
    server_name _;

    # WebSocket support
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/${SERVICE_NAME} /etc/nginx/sites-enabled/${SERVICE_NAME}
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Configure environment variables:"
echo "   sudo nano ${INSTALL_DIR}/.env"
echo ""
echo "2. Verify B210 hardware connection:"
echo "   ${INSTALL_DIR}/hardware/verify_b210.sh"
echo ""
echo "3. Start the service:"
echo "   sudo systemctl start ${SERVICE_NAME}"
echo ""
echo "4. Check service status:"
echo "   sudo systemctl status ${SERVICE_NAME}"
echo ""
echo "5. View logs:"
echo "   sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "6. Access the application:"
echo "   http://$(hostname -I | awk '{print $1}')"
echo ""
echo -e "${GREEN}Installation directory: ${INSTALL_DIR}${NC}"
echo -e "${GREEN}Service name: ${SERVICE_NAME}${NC}"
echo ""
