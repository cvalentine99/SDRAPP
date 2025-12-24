#!/bin/bash
# Remote Compilation Script for gx10-alpha
# Triggers compilation of C++ daemons via SSH
# Author: Manus AI
# Date: Dec 24, 2025

set -e  # Exit on any error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=================================="
echo "Ettus B210 SDR - Remote Compilation"
echo "Target: gx10-alpha ARM64 server"
echo -e "==================================${NC}"
echo ""

# Configuration
DEFAULT_USER="ubuntu"
DEFAULT_HOST="gx10-alpha"
DEFAULT_PORT="22"
DEFAULT_REMOTE_DIR="~/ettus-sdr-hardware"

# Parse command line arguments
REMOTE_USER="${1:-$DEFAULT_USER}"
REMOTE_HOST="${2:-$DEFAULT_HOST}"
REMOTE_PORT="${3:-$DEFAULT_PORT}"
REMOTE_DIR="${4:-$DEFAULT_REMOTE_DIR}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Remote User: $REMOTE_USER"
echo "  Remote Host: $REMOTE_HOST"
echo "  Remote Port: $REMOTE_PORT"
echo "  Remote Directory: $REMOTE_DIR"
echo ""

echo -e "${GREEN}Step 1: Testing SSH connection...${NC}"
if ! ssh -p "$REMOTE_PORT" -o ConnectTimeout=5 "$REMOTE_USER@$REMOTE_HOST" exit 2>/dev/null; then
  echo -e "${RED}❌ SSH connection failed${NC}"
  echo "Please check:"
  echo "  - Server is reachable: ping $REMOTE_HOST"
  echo "  - SSH port is correct: $REMOTE_PORT"
  echo "  - SSH key is configured or password is correct"
  exit 1
fi
echo -e "${GREEN}✅ SSH connection successful${NC}"

echo ""
echo -e "${GREEN}Step 2: Checking remote directory...${NC}"
ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" << EOF
  if [ ! -d "$REMOTE_DIR" ]; then
    echo "❌ Remote directory not found: $REMOTE_DIR"
    echo "Please run deploy_to_gx10.sh first to transfer files"
    exit 1
  fi
  echo "✅ Remote directory exists"
  
  cd "$REMOTE_DIR"
  
  if [ ! -f "CMakeLists.txt" ]; then
    echo "❌ CMakeLists.txt not found"
    echo "Please ensure hardware directory was transferred correctly"
    exit 1
  fi
  echo "✅ CMakeLists.txt found"
  
  if [ ! -d "src" ]; then
    echo "❌ src/ directory not found"
    exit 1
  fi
  echo "✅ src/ directory found"
EOF

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Remote directory check failed${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}Step 3: Checking dependencies...${NC}"
ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
  echo "Checking for required tools and libraries..."
  
  # Check cmake
  if command -v cmake &> /dev/null; then
    CMAKE_VERSION=$(cmake --version | head -1)
    echo "✅ CMake: $CMAKE_VERSION"
  else
    echo "❌ CMake not found"
    echo "Please run: ./install_dependencies.sh"
    exit 1
  fi
  
  # Check g++
  if command -v g++ &> /dev/null; then
    GCC_VERSION=$(g++ --version | head -1)
    echo "✅ g++: $GCC_VERSION"
  else
    echo "❌ g++ not found"
    exit 1
  fi
  
  # Check UHD
  if command -v uhd_find_devices &> /dev/null; then
    UHD_VERSION=$(uhd_find_devices --version 2>&1 | grep "UHD" | head -1 || echo "unknown")
    echo "✅ UHD: $UHD_VERSION"
  else
    echo "⚠️  UHD not found (optional for compilation, required for runtime)"
  fi
  
  # Check FFTW3
  if pkg-config --exists fftw3; then
    FFTW_VERSION=$(pkg-config --modversion fftw3)
    echo "✅ FFTW3: $FFTW_VERSION"
  else
    echo "❌ FFTW3 not found"
    echo "Please run: sudo apt-get install libfftw3-dev"
    exit 1
  fi
EOF

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Dependency check failed${NC}"
  echo ""
  echo "Please install dependencies first:"
  echo "  ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST"
  echo "  cd $REMOTE_DIR"
  echo "  ./install_dependencies.sh"
  exit 1
fi

echo ""
echo -e "${GREEN}Step 4: Creating build directory...${NC}"
ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" << EOF
  cd "$REMOTE_DIR"
  mkdir -p build
  echo "✅ Build directory created"
EOF

echo ""
echo -e "${GREEN}Step 5: Running CMake configuration...${NC}"
echo -e "${YELLOW}This may take 10-30 seconds...${NC}"
echo ""

ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" << EOF
  cd "$REMOTE_DIR/build"
  cmake .. 2>&1
EOF

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ CMake configuration failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ CMake configuration successful${NC}"

echo ""
echo -e "${GREEN}Step 6: Compiling C++ daemons...${NC}"
echo -e "${YELLOW}This may take 2-5 minutes on ARM64...${NC}"
echo ""

ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" << EOF
  cd "$REMOTE_DIR/build"
  
  # Get number of CPU cores
  NPROC=\$(nproc)
  echo "Compiling with \$NPROC parallel jobs..."
  echo ""
  
  make -j\$NPROC 2>&1
EOF

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Compilation failed${NC}"
  echo ""
  echo "To debug, SSH into the server and check build logs:"
  echo "  ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST"
  echo "  cd $REMOTE_DIR/build"
  echo "  make VERBOSE=1"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Compilation successful!${NC}"

echo ""
echo -e "${GREEN}Step 7: Verifying binaries...${NC}"

ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" << EOF
  cd "$REMOTE_DIR"
  
  if [ -f "verify_build.sh" ]; then
    echo "Running build verification script..."
    echo ""
    ./verify_build.sh
  else
    echo "⚠️  verify_build.sh not found, performing manual checks..."
    
    BIN_DIR="build/bin"
    
    if [ -f "\$BIN_DIR/sdr_streamer" ]; then
      SIZE=\$(stat -c%s "\$BIN_DIR/sdr_streamer")
      echo "✅ sdr_streamer: \$(numfmt --to=iec-i --suffix=B \$SIZE)"
    else
      echo "❌ sdr_streamer not found"
    fi
    
    if [ -f "\$BIN_DIR/freq_scanner" ]; then
      SIZE=\$(stat -c%s "\$BIN_DIR/freq_scanner")
      echo "✅ freq_scanner: \$(numfmt --to=iec-i --suffix=B \$SIZE)"
    else
      echo "❌ freq_scanner not found"
    fi
    
    if [ -f "\$BIN_DIR/iq_recorder" ]; then
      SIZE=\$(stat -c%s "\$BIN_DIR/iq_recorder")
      echo "✅ iq_recorder: \$(numfmt --to=iec-i --suffix=B \$SIZE)"
    else
      echo "❌ iq_recorder not found"
    fi
  fi
EOF

echo ""
echo -e "${CYAN}=================================="
echo "✅ Remote Compilation Complete!"
echo -e "==================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "  1. Install binaries system-wide (optional):"
echo "     ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST"
echo "     cd $REMOTE_DIR/build"
echo "     sudo cp bin/sdr_streamer /usr/local/bin/"
echo "     sudo cp bin/freq_scanner /usr/local/bin/"
echo "     sudo cp bin/iq_recorder /usr/local/bin/"
echo ""
echo "  2. Test with B210 hardware:"
echo "     ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST"
echo "     cd $REMOTE_DIR/build/bin"
echo "     ./sdr_streamer --freq 915e6 --rate 10e6 --gain 40"
echo ""
echo "  3. Configure web application:"
echo "     Set SDR_MODE=production in .env"
echo "     Set SDR_STREAMER_PATH=/usr/local/bin/sdr_streamer (if installed system-wide)"
echo "     Restart web application"
echo ""
echo -e "${GREEN}Compilation script finished successfully!${NC}"
