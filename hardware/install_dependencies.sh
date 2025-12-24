#!/bin/bash
# Dependency Installation Script for Ettus B210 SDR C++ Daemons
# Target: gx10-alpha ARM64 bare metal server
# Author: Manus AI
# Date: Dec 24, 2025

set -e  # Exit on any error

echo "=================================="
echo "Ettus B210 SDR - Dependency Installer"
echo "Target: ARM64 Linux (gx10-alpha)"
echo "=================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "⚠️  Running as root. This is fine for system-wide installation."
  SUDO=""
else
  echo "Running as non-root user. Will use sudo for system operations."
  SUDO="sudo"
fi

echo ""
echo "Step 1: Updating package lists..."
$SUDO apt-get update

echo ""
echo "Step 2: Installing build tools..."
$SUDO apt-get install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  python3-mako

echo ""
echo "Step 3: Installing UHD dependencies..."
$SUDO apt-get install -y \
  libboost-all-dev \
  libusb-1.0-0-dev \
  python3-numpy \
  python3-requests

echo ""
echo "Step 4: Installing FFTW3 (Fast Fourier Transform library)..."
$SUDO apt-get install -y \
  libfftw3-dev \
  libfftw3-single3

echo ""
echo "Step 5: Installing additional libraries..."
$SUDO apt-get install -y \
  libjsoncpp-dev \
  nlohmann-json3-dev

echo ""
echo "Step 6: Checking for existing UHD installation..."
if command -v uhd_find_devices &> /dev/null; then
  UHD_VERSION=$(uhd_find_devices --version 2>&1 | grep "UHD" | head -1 || echo "Unknown")
  echo "✅ UHD already installed: $UHD_VERSION"
  echo ""
  read -p "Do you want to reinstall UHD from source? (y/N): " REINSTALL_UHD
  if [[ ! "$REINSTALL_UHD" =~ ^[Yy]$ ]]; then
    echo "Skipping UHD installation."
    SKIP_UHD=true
  fi
fi

if [ "$SKIP_UHD" != "true" ]; then
  echo ""
  echo "Step 7: Installing UHD (USRP Hardware Driver) from source..."
  echo "This may take 10-30 minutes on ARM64..."
  
  # Create temporary build directory
  TEMP_DIR=$(mktemp -d)
  cd "$TEMP_DIR"
  
  echo "Cloning UHD repository (v4.6.0.0)..."
  git clone --branch v4.6.0.0 --depth 1 https://github.com/EttusResearch/uhd.git
  cd uhd/host
  
  echo "Configuring UHD build..."
  mkdir -p build
  cd build
  cmake -DCMAKE_INSTALL_PREFIX=/usr/local \
        -DENABLE_PYTHON_API=OFF \
        -DENABLE_EXAMPLES=OFF \
        -DENABLE_TESTS=OFF \
        -DENABLE_UTILS=ON \
        ..
  
  echo "Building UHD (this will take a while)..."
  make -j$(nproc)
  
  echo "Installing UHD..."
  $SUDO make install
  $SUDO ldconfig
  
  echo "Cleaning up temporary files..."
  cd ~
  rm -rf "$TEMP_DIR"
  
  echo "✅ UHD installed successfully"
fi

echo ""
echo "Step 8: Downloading UHD FPGA images..."
$SUDO uhd_images_downloader -t b2xx

echo ""
echo "Step 9: Configuring USB permissions for B210..."
$SUDO tee /etc/udev/rules.d/uhd-usrp.rules > /dev/null <<EOF
# USRP B200/B210 USB permissions
SUBSYSTEM=="usb", ATTR{idVendor}=="2500", ATTR{idProduct}=="0020", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="2500", ATTR{idProduct}=="0021", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="2500", ATTR{idProduct}=="0022", MODE="0666"
SUBSYSTEM=="usb", ATTR{idVendor}=="3923", ATTR{idProduct}=="7813", MODE="0666"
EOF

echo "Reloading udev rules..."
$SUDO udevadm control --reload-rules
$SUDO udevadm trigger

echo ""
echo "=================================="
echo "✅ Dependency Installation Complete!"
echo "=================================="
echo ""
echo "Installed packages:"
echo "  - Build tools (gcc, g++, cmake)"
echo "  - Boost libraries (all components)"
echo "  - FFTW3 (FFT computation)"
echo "  - UHD (USRP Hardware Driver)"
echo "  - JSON libraries (nlohmann-json)"
echo ""
echo "Next steps:"
echo "  1. Connect your Ettus B210 to USB 3.0 port"
echo "  2. Run: uhd_find_devices"
echo "  3. Run: uhd_usrp_probe --args='type=b200'"
echo "  4. Compile C++ daemons: cd build && cmake .. && make -j\$(nproc)"
echo ""
echo "For troubleshooting, see: hardware/BUILD_INSTRUCTIONS.md"
echo "=================================="
