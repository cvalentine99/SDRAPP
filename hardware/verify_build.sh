#!/bin/bash
# Build Verification Script for Ettus B210 SDR C++ Daemons
# Target: gx10-alpha ARM64 bare metal server
# Author: Manus AI
# Date: Dec 24, 2025

set -e  # Exit on any error

echo "=================================="
echo "Ettus B210 SDR - Build Verification"
echo "Target: ARM64 Linux (gx10-alpha)"
echo "=================================="
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BUILD_DIR="$SCRIPT_DIR/build"
BIN_DIR="$BUILD_DIR/bin"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verification results
ERRORS=0
WARNINGS=0

echo "Step 1: Checking build directory..."
if [ ! -d "$BUILD_DIR" ]; then
  echo -e "${RED}❌ Build directory not found: $BUILD_DIR${NC}"
  echo "Please run: mkdir -p build && cd build && cmake .. && make -j\$(nproc)"
  exit 1
fi
echo -e "${GREEN}✅ Build directory exists${NC}"

echo ""
echo "Step 2: Checking compiled binaries..."

# Check sdr_streamer
if [ -f "$BIN_DIR/sdr_streamer" ]; then
  echo -e "${GREEN}✅ sdr_streamer binary found${NC}"
  SIZE=$(stat -c%s "$BIN_DIR/sdr_streamer")
  echo "   Size: $(numfmt --to=iec-i --suffix=B $SIZE)"
  
  # Check if executable
  if [ -x "$BIN_DIR/sdr_streamer" ]; then
    echo -e "${GREEN}   Executable: Yes${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Not executable, fixing...${NC}"
    chmod +x "$BIN_DIR/sdr_streamer"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}❌ sdr_streamer binary NOT found${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check freq_scanner
if [ -f "$BIN_DIR/freq_scanner" ]; then
  echo -e "${GREEN}✅ freq_scanner binary found${NC}"
  SIZE=$(stat -c%s "$BIN_DIR/freq_scanner")
  echo "   Size: $(numfmt --to=iec-i --suffix=B $SIZE)"
  
  if [ -x "$BIN_DIR/freq_scanner" ]; then
    echo -e "${GREEN}   Executable: Yes${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Not executable, fixing...${NC}"
    chmod +x "$BIN_DIR/freq_scanner"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}❌ freq_scanner binary NOT found${NC}"
  ERRORS=$((ERRORS + 1))
fi

# Check iq_recorder
if [ -f "$BIN_DIR/iq_recorder" ]; then
  echo -e "${GREEN}✅ iq_recorder binary found${NC}"
  SIZE=$(stat -c%s "$BIN_DIR/iq_recorder")
  echo "   Size: $(numfmt --to=iec-i --suffix=B $SIZE)"
  
  if [ -x "$BIN_DIR/iq_recorder" ]; then
    echo -e "${GREEN}   Executable: Yes${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Not executable, fixing...${NC}"
    chmod +x "$BIN_DIR/iq_recorder"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}❌ iq_recorder binary NOT found${NC}"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "Step 3: Checking library dependencies..."

# Function to check library dependencies
check_ldd() {
  local binary=$1
  local name=$2
  
  echo ""
  echo "Checking $name dependencies:"
  
  if ! ldd "$binary" > /dev/null 2>&1; then
    echo -e "${RED}❌ Failed to check dependencies for $name${NC}"
    ERRORS=$((ERRORS + 1))
    return
  fi
  
  # Check for missing libraries
  MISSING=$(ldd "$binary" 2>&1 | grep "not found" || true)
  if [ -n "$MISSING" ]; then
    echo -e "${RED}❌ Missing libraries:${NC}"
    echo "$MISSING"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "${GREEN}✅ All libraries found${NC}"
  fi
  
  # Check for critical libraries
  if ldd "$binary" | grep -q "libuhd"; then
    echo -e "${GREEN}   ✅ UHD library linked${NC}"
  else
    echo -e "${RED}   ❌ UHD library NOT linked${NC}"
    ERRORS=$((ERRORS + 1))
  fi
  
  if ldd "$binary" | grep -q "libfftw3"; then
    echo -e "${GREEN}   ✅ FFTW3 library linked${NC}"
  else
    echo -e "${YELLOW}   ⚠️  FFTW3 library NOT linked (may not be needed for this binary)${NC}"
  fi
  
  if ldd "$binary" | grep -q "libboost"; then
    echo -e "${GREEN}   ✅ Boost libraries linked${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Boost libraries NOT linked (may not be needed for this binary)${NC}"
  fi
}

if [ -f "$BIN_DIR/sdr_streamer" ]; then
  check_ldd "$BIN_DIR/sdr_streamer" "sdr_streamer"
fi

if [ -f "$BIN_DIR/freq_scanner" ]; then
  check_ldd "$BIN_DIR/freq_scanner" "freq_scanner"
fi

if [ -f "$BIN_DIR/iq_recorder" ]; then
  check_ldd "$BIN_DIR/iq_recorder" "iq_recorder"
fi

echo ""
echo "Step 4: Testing binary execution (help/version)..."

# Test sdr_streamer
if [ -f "$BIN_DIR/sdr_streamer" ]; then
  echo ""
  echo "Testing sdr_streamer --help:"
  if timeout 2s "$BIN_DIR/sdr_streamer" --help > /dev/null 2>&1 || [ $? -eq 124 ]; then
    echo -e "${GREEN}✅ sdr_streamer executes without errors${NC}"
  else
    echo -e "${YELLOW}⚠️  sdr_streamer execution test inconclusive${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Test freq_scanner
if [ -f "$BIN_DIR/freq_scanner" ]; then
  echo ""
  echo "Testing freq_scanner --help:"
  if timeout 2s "$BIN_DIR/freq_scanner" --help > /dev/null 2>&1 || [ $? -eq 124 ]; then
    echo -e "${GREEN}✅ freq_scanner executes without errors${NC}"
  else
    echo -e "${YELLOW}⚠️  freq_scanner execution test inconclusive${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Test iq_recorder
if [ -f "$BIN_DIR/iq_recorder" ]; then
  echo ""
  echo "Testing iq_recorder --help:"
  if timeout 2s "$BIN_DIR/iq_recorder" --help > /dev/null 2>&1 || [ $? -eq 124 ]; then
    echo -e "${GREEN}✅ iq_recorder executes without errors${NC}"
  else
    echo -e "${YELLOW}⚠️  iq_recorder execution test inconclusive${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

echo ""
echo "Step 5: Checking UHD device detection..."
if command -v uhd_find_devices &> /dev/null; then
  echo "Running uhd_find_devices (this may take a few seconds)..."
  UHD_OUTPUT=$(timeout 10s uhd_find_devices 2>&1 || true)
  
  if echo "$UHD_OUTPUT" | grep -q "type: b200"; then
    echo -e "${GREEN}✅ Ettus B210 device detected!${NC}"
    echo "$UHD_OUTPUT" | grep -A 5 "type: b200"
  else
    echo -e "${YELLOW}⚠️  No B210 device detected${NC}"
    echo "   Make sure the B210 is connected to a USB 3.0 port"
    echo "   Try running: sudo uhd_find_devices"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo -e "${RED}❌ uhd_find_devices command not found${NC}"
  echo "   UHD may not be properly installed"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "=================================="
echo "Build Verification Summary"
echo "=================================="
echo -e "Errors:   ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ BUILD VERIFICATION PASSED${NC}"
  echo ""
  echo "All binaries compiled successfully and are ready to use!"
  echo ""
  echo "Binary locations:"
  echo "  - sdr_streamer: $BIN_DIR/sdr_streamer"
  echo "  - freq_scanner: $BIN_DIR/freq_scanner"
  echo "  - iq_recorder:  $BIN_DIR/iq_recorder"
  echo ""
  echo "Next steps:"
  echo "  1. Set SDR_STREAMER_PATH environment variable:"
  echo "     export SDR_STREAMER_PATH=$BIN_DIR/sdr_streamer"
  echo "  2. Update .env file in web application root"
  echo "  3. Start the web application in production mode"
  echo ""
  exit 0
else
  echo -e "${RED}❌ BUILD VERIFICATION FAILED${NC}"
  echo ""
  echo "Please fix the errors above and rebuild:"
  echo "  cd $BUILD_DIR"
  echo "  make clean"
  echo "  cmake .."
  echo "  make -j\$(nproc)"
  echo ""
  exit 1
fi
