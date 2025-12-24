#!/bin/bash
# Automated Deployment Script for gx10-alpha
# Transfers hardware directory and optionally triggers remote compilation
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
echo "Ettus B210 SDR - Automated Deployment"
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
AUTO_COMPILE="${5:-no}"

echo -e "${YELLOW}Configuration:${NC}"
echo "  Remote User: $REMOTE_USER"
echo "  Remote Host: $REMOTE_HOST"
echo "  Remote Port: $REMOTE_PORT"
echo "  Remote Directory: $REMOTE_DIR"
echo "  Auto Compile: $AUTO_COMPILE"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

# Check if hardware directory exists
if [ ! -d "$SCRIPT_DIR" ]; then
  echo -e "${RED}❌ Hardware directory not found: $SCRIPT_DIR${NC}"
  exit 1
fi

echo -e "${GREEN}Step 1: Testing SSH connection...${NC}"
if ssh -p "$REMOTE_PORT" -o ConnectTimeout=5 -o BatchMode=yes "$REMOTE_USER@$REMOTE_HOST" exit 2>/dev/null; then
  echo -e "${GREEN}✅ SSH connection successful (using SSH key)${NC}"
else
  echo -e "${YELLOW}⚠️  SSH key authentication failed, will prompt for password${NC}"
  echo ""
  read -p "Continue with password authentication? (y/N): " CONTINUE
  if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
  fi
fi

echo ""
echo -e "${GREEN}Step 2: Creating tarball of hardware directory...${NC}"
TARBALL_NAME="hardware-deployment-$(date +%Y%m%d-%H%M%S).tar.gz"
TARBALL_PATH="/tmp/$TARBALL_NAME"

cd "$PARENT_DIR"
tar -czf "$TARBALL_PATH" hardware/ --exclude='hardware/build' --exclude='*.o' --exclude='*.a'

TARBALL_SIZE=$(du -h "$TARBALL_PATH" | cut -f1)
echo -e "${GREEN}✅ Tarball created: $TARBALL_PATH ($TARBALL_SIZE)${NC}"

echo ""
echo -e "${GREEN}Step 3: Transferring tarball to gx10-alpha...${NC}"
echo "  Destination: $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
echo ""

scp -P "$REMOTE_PORT" "$TARBALL_PATH" "$REMOTE_USER@$REMOTE_HOST:/tmp/$TARBALL_NAME"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Transfer successful${NC}"
else
  echo -e "${RED}❌ Transfer failed${NC}"
  rm -f "$TARBALL_PATH"
  exit 1
fi

echo ""
echo -e "${GREEN}Step 4: Extracting tarball on remote server...${NC}"

ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" << EOF
  set -e
  echo "Creating directory: $REMOTE_DIR"
  mkdir -p "$REMOTE_DIR"
  
  echo "Extracting tarball..."
  cd "$REMOTE_DIR"
  tar -xzf /tmp/$TARBALL_NAME --strip-components=1
  
  echo "Cleaning up tarball..."
  rm -f /tmp/$TARBALL_NAME
  
  echo "Setting permissions..."
  chmod +x install_dependencies.sh verify_build.sh 2>/dev/null || true
  
  echo "✅ Extraction complete"
EOF

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Extraction successful${NC}"
else
  echo -e "${RED}❌ Extraction failed${NC}"
  rm -f "$TARBALL_PATH"
  exit 1
fi

# Clean up local tarball
rm -f "$TARBALL_PATH"

echo ""
echo -e "${GREEN}Step 5: Verifying remote installation...${NC}"

ssh -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST" << EOF
  cd "$REMOTE_DIR"
  echo "Files in remote directory:"
  ls -lh
  echo ""
  echo "Checking for key files..."
  [ -f "install_dependencies.sh" ] && echo "✅ install_dependencies.sh" || echo "❌ install_dependencies.sh MISSING"
  [ -f "verify_build.sh" ] && echo "✅ verify_build.sh" || echo "❌ verify_build.sh MISSING"
  [ -f "CMakeLists.txt" ] && echo "✅ CMakeLists.txt" || echo "❌ CMakeLists.txt MISSING"
  [ -d "src" ] && echo "✅ src/ directory" || echo "❌ src/ directory MISSING"
EOF

echo ""
echo -e "${CYAN}=================================="
echo "✅ Deployment Complete!"
echo -e "==================================${NC}"
echo ""
echo -e "${YELLOW}Next steps on gx10-alpha:${NC}"
echo ""
echo "  1. SSH into the server:"
echo "     ssh -p $REMOTE_PORT $REMOTE_USER@$REMOTE_HOST"
echo ""
echo "  2. Navigate to hardware directory:"
echo "     cd $REMOTE_DIR"
echo ""
echo "  3. Install dependencies (10-30 minutes):"
echo "     ./install_dependencies.sh"
echo ""
echo "  4. Compile C++ daemons (2-5 minutes):"
echo "     mkdir -p build && cd build"
echo "     cmake .."
echo "     make -j\$(nproc)"
echo ""
echo "  5. Verify build:"
echo "     cd .."
echo "     ./verify_build.sh"
echo ""
echo -e "${YELLOW}Or use the automated remote compilation script:${NC}"
echo "  ./remote_compile.sh $REMOTE_USER $REMOTE_HOST $REMOTE_PORT $REMOTE_DIR"
echo ""

# Auto-compile if requested
if [[ "$AUTO_COMPILE" =~ ^[Yy]$ ]]; then
  echo ""
  echo -e "${CYAN}Auto-compile enabled, triggering remote compilation...${NC}"
  echo ""
  
  REMOTE_COMPILE_SCRIPT="$(dirname "$0")/remote_compile.sh"
  if [ -f "$REMOTE_COMPILE_SCRIPT" ]; then
    "$REMOTE_COMPILE_SCRIPT" "$REMOTE_USER" "$REMOTE_HOST" "$REMOTE_PORT" "$REMOTE_DIR"
  else
    echo -e "${YELLOW}⚠️  remote_compile.sh not found, skipping auto-compile${NC}"
  fi
fi

echo -e "${GREEN}Deployment script finished successfully!${NC}"
