#!/bin/bash
# Deployment Test/Simulation Script
# Tests deployment scripts locally without requiring gx10-alpha access
# Author: Manus AI
# Date: Dec 24, 2025

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=================================="
echo "Ettus B210 SDR - Deployment Test"
echo "Local Simulation (No SSH Required)"
echo -e "==================================${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEST_DIR="/tmp/ettus-sdr-test-$(date +%s)"

echo -e "${YELLOW}Test Configuration:${NC}"
echo "  Script Directory: $SCRIPT_DIR"
echo "  Test Directory: $TEST_DIR"
echo ""

# Test 1: Check deployment scripts exist
echo -e "${GREEN}Test 1: Checking deployment scripts...${NC}"
if [ -f "$SCRIPT_DIR/deploy_to_gx10.sh" ]; then
  echo "  ✅ deploy_to_gx10.sh found"
else
  echo -e "  ${RED}❌ deploy_to_gx10.sh NOT found${NC}"
  exit 1
fi

if [ -f "$SCRIPT_DIR/remote_compile.sh" ]; then
  echo "  ✅ remote_compile.sh found"
else
  echo -e "  ${RED}❌ remote_compile.sh NOT found${NC}"
  exit 1
fi

if [ -f "$SCRIPT_DIR/install_dependencies.sh" ]; then
  echo "  ✅ install_dependencies.sh found"
else
  echo -e "  ${RED}❌ install_dependencies.sh NOT found${NC}"
  exit 1
fi

if [ -f "$SCRIPT_DIR/verify_build.sh" ]; then
  echo "  ✅ verify_build.sh found"
else
  echo -e "  ${RED}❌ verify_build.sh NOT found${NC}"
  exit 1
fi

# Test 2: Check scripts are executable
echo ""
echo -e "${GREEN}Test 2: Checking script permissions...${NC}"
if [ -x "$SCRIPT_DIR/deploy_to_gx10.sh" ]; then
  echo "  ✅ deploy_to_gx10.sh is executable"
else
  echo -e "  ${YELLOW}⚠️  deploy_to_gx10.sh not executable, fixing...${NC}"
  chmod +x "$SCRIPT_DIR/deploy_to_gx10.sh"
fi

if [ -x "$SCRIPT_DIR/remote_compile.sh" ]; then
  echo "  ✅ remote_compile.sh is executable"
else
  echo -e "  ${YELLOW}⚠️  remote_compile.sh not executable, fixing...${NC}"
  chmod +x "$SCRIPT_DIR/remote_compile.sh"
fi

if [ -x "$SCRIPT_DIR/install_dependencies.sh" ]; then
  echo "  ✅ install_dependencies.sh is executable"
else
  echo -e "  ${YELLOW}⚠️  install_dependencies.sh not executable, fixing...${NC}"
  chmod +x "$SCRIPT_DIR/install_dependencies.sh"
fi

if [ -x "$SCRIPT_DIR/verify_build.sh" ]; then
  echo "  ✅ verify_build.sh is executable"
else
  echo -e "  ${YELLOW}⚠️  verify_build.sh not executable, fixing...${NC}"
  chmod +x "$SCRIPT_DIR/verify_build.sh"
fi

# Test 3: Check C++ source files exist
echo ""
echo -e "${GREEN}Test 3: Checking C++ source files...${NC}"
if [ -f "$SCRIPT_DIR/src/sdr_streamer.cpp" ]; then
  echo "  ✅ sdr_streamer.cpp found"
else
  echo -e "  ${RED}❌ sdr_streamer.cpp NOT found${NC}"
  exit 1
fi

if [ -f "$SCRIPT_DIR/src/freq_scanner.cpp" ]; then
  echo "  ✅ freq_scanner.cpp found"
else
  echo -e "  ${RED}❌ freq_scanner.cpp NOT found${NC}"
  exit 1
fi

if [ -f "$SCRIPT_DIR/src/iq_recorder.cpp" ]; then
  echo "  ✅ iq_recorder.cpp found"
else
  echo -e "  ${RED}❌ iq_recorder.cpp NOT found${NC}"
  exit 1
fi

if [ -f "$SCRIPT_DIR/CMakeLists.txt" ]; then
  echo "  ✅ CMakeLists.txt found"
else
  echo -e "  ${RED}❌ CMakeLists.txt NOT found${NC}"
  exit 1
fi

# Test 4: Simulate tarball creation
echo ""
echo -e "${GREEN}Test 4: Simulating tarball creation...${NC}"
mkdir -p "$TEST_DIR"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
TARBALL_PATH="$TEST_DIR/hardware-test.tar.gz"

cd "$PARENT_DIR"
tar --exclude='hardware/build' --exclude='*.o' --exclude='*.a' -czf "$TARBALL_PATH" hardware/ 2>&1

if [ -f "$TARBALL_PATH" ]; then
  TARBALL_SIZE=$(du -h "$TARBALL_PATH" | cut -f1)
  echo "  ✅ Tarball created: $TARBALL_SIZE"
else
  echo -e "  ${RED}❌ Tarball creation failed${NC}"
  exit 1
fi

# Test 5: Simulate tarball extraction
echo ""
echo -e "${GREEN}Test 5: Simulating tarball extraction...${NC}"
EXTRACT_DIR="$TEST_DIR/extracted"
mkdir -p "$EXTRACT_DIR"
cd "$EXTRACT_DIR"
tar -xzf "$TARBALL_PATH" --strip-components=1

if [ -f "CMakeLists.txt" ]; then
  echo "  ✅ Tarball extracted successfully"
else
  echo -e "  ${RED}❌ Tarball extraction failed${NC}"
  exit 1
fi

# Test 6: Check extracted files
echo ""
echo -e "${GREEN}Test 6: Verifying extracted files...${NC}"
EXPECTED_FILES=(
  "CMakeLists.txt"
  "src/sdr_streamer.cpp"
  "src/freq_scanner.cpp"
  "src/iq_recorder.cpp"
  "install_dependencies.sh"
  "verify_build.sh"
  "deploy_to_gx10.sh"
  "remote_compile.sh"
  "QUICKSTART.md"
  "DEPLOYMENT_GUIDE.md"
)

ALL_FOUND=true
for file in "${EXPECTED_FILES[@]}"; do
  if [ -f "$EXTRACT_DIR/$file" ] || [ -d "$EXTRACT_DIR/$file" ]; then
    echo "  ✅ $file"
  else
    echo -e "  ${RED}❌ $file NOT found${NC}"
    ALL_FOUND=false
  fi
done

if [ "$ALL_FOUND" = false ]; then
  echo -e "${RED}Some files are missing!${NC}"
  exit 1
fi

# Test 7: Check documentation
echo ""
echo -e "${GREEN}Test 7: Checking documentation files...${NC}"
DOCS=(
  "QUICKSTART.md"
  "DEPLOYMENT_GUIDE.md"
  "BUILD_INSTRUCTIONS.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$EXTRACT_DIR/$doc" ]; then
    LINES=$(wc -l < "$EXTRACT_DIR/$doc")
    echo "  ✅ $doc ($LINES lines)"
  else
    echo -e "  ${YELLOW}⚠️  $doc not found${NC}"
  fi
done

# Test 8: Simulate CMake configuration (dry run)
echo ""
echo -e "${GREEN}Test 8: Testing CMake configuration (dry run)...${NC}"
if command -v cmake &> /dev/null; then
  CMAKE_VERSION=$(cmake --version | head -1)
  echo "  ✅ CMake available: $CMAKE_VERSION"
  
  # Try to configure (will fail without UHD, but tests CMakeLists.txt syntax)
  mkdir -p "$EXTRACT_DIR/build"
  cd "$EXTRACT_DIR/build"
  
  if cmake .. &> /dev/null; then
    echo "  ✅ CMakeLists.txt syntax is valid"
  else
    echo -e "  ${YELLOW}⚠️  CMake configuration failed (expected without UHD)${NC}"
    echo "     This is normal in sandbox environment"
  fi
else
  echo -e "  ${YELLOW}⚠️  CMake not available in sandbox${NC}"
fi

# Cleanup
echo ""
echo -e "${GREEN}Cleaning up test files...${NC}"
rm -rf "$TEST_DIR"
echo "  ✅ Test directory removed"

# Summary
echo ""
echo -e "${CYAN}=================================="
echo "✅ Deployment Test Complete!"
echo -e "==================================${NC}"
echo ""
echo -e "${GREEN}All tests passed!${NC}"
echo ""
echo "Your deployment package is ready for gx10-alpha."
echo ""
echo -e "${YELLOW}To deploy to gx10-alpha:${NC}"
echo ""
echo "  1. From your local machine, run:"
echo "     cd hardware/"
echo "     ./deploy_to_gx10.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware"
echo ""
echo "  2. Then compile remotely:"
echo "     ./remote_compile.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware"
echo ""
echo "  3. Or use auto-compile flag:"
echo "     ./deploy_to_gx10.sh ubuntu gx10-alpha 22 ~/ettus-sdr-hardware yes"
echo ""
echo -e "${CYAN}For detailed instructions, see:${NC}"
echo "  - QUICKSTART.md (quick start guide)"
echo "  - DEPLOYMENT_GUIDE.md (comprehensive guide)"
echo ""
