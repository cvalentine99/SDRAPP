#!/bin/bash
# verify_b210.sh - B210 Hardware Verification Script
# 
# Verifies Ettus B210 hardware detection and basic functionality
# Uses pre-compiled UHD tools from hardware/bin/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UHD_BIN="$SCRIPT_DIR/bin"

echo "========================================="
echo "Ettus B210 Hardware Verification"
echo "========================================="
echo ""

# Check if UHD tools exist
if [ ! -f "$UHD_BIN/uhd_find_devices" ]; then
    echo "ERROR: UHD tools not found in $UHD_BIN"
    echo "Please ensure uhd_tools.zip has been extracted to hardware/bin/"
    exit 1
fi

echo "[1/4] Checking UHD configuration..."
"$UHD_BIN/uhd_config_info" --version || true
echo ""

echo "[2/4] Detecting USRP devices..."
if ! "$UHD_BIN/uhd_find_devices"; then
    echo "ERROR: No USRP devices found!"
    echo "Please check:"
    echo "  - B210 is connected via USB 3.0"
    echo "  - USB cable is properly seated"
    echo "  - Power LED on B210 is lit"
    exit 1
fi
echo ""

echo "[3/4] Probing B210 details..."
if ! "$UHD_BIN/uhd_usrp_probe" --args="type=b200"; then
    echo "WARNING: uhd_usrp_probe failed, but device was detected"
    echo "This may indicate a firmware/FPGA image mismatch"
fi
echo ""

echo "[4/4] Checking GPSDO (if installed)..."
if "$UHD_BIN/uhd_usrp_probe" --args="type=b200" 2>&1 | grep -q "GPSDO"; then
    echo "✓ GPSDO detected"
else
    echo "⚠ No GPSDO detected (optional)"
fi
echo ""

echo "========================================="
echo "✓ B210 Hardware Verification Complete"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Build C++ daemons: cd hardware/build && cmake .. && make"
echo "  2. Test FFT streaming: ./sdr_streamer"
echo "  3. Start web server: cd .. && pnpm dev"
