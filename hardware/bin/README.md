# UHD Tools (Pre-compiled)

Pre-compiled UHD (USRP Hardware Driver) utilities for B210 hardware verification and testing.

## Tools Included

### Device Detection & Probing
- **uhd_find_devices** - Detect all connected USRP devices
- **uhd_usrp_probe** - Detailed hardware information and capabilities
- **uhd_config_info** - UHD library configuration and version

### Calibration
- **uhd_cal_rx_iq_balance** - RX IQ imbalance calibration
- **uhd_cal_tx_dc_offset** - TX DC offset calibration
- **uhd_cal_tx_iq_balance** - TX IQ imbalance calibration
- **uhd_adc_self_cal** - ADC self-calibration (B210 specific)

### Signal Processing
- **uhd_fft** - Real-time FFT visualization (requires X11/GUI)
- **uhd_rx_cfile** - Record IQ samples to file
- **uhd_rx_nogui** - Receive samples without GUI

### Signal Generation
- **uhd_siggen** - Command-line signal generator
- **uhd_siggen_gui** - GUI signal generator (requires X11)

### Firmware & Images
- **uhd_image_loader** - Load firmware/FPGA images to device
- **uhd_images_downloader** - Download official UHD images

### Advanced
- **rfnoc_image_builder** - RFNoC FPGA image builder
- **usrpctl** - USRP control utility
- **usrp2_card_burner** - USRP2 SD card burner

## Quick Start

```bash
# Detect B210
./uhd_find_devices

# Probe B210 details
./uhd_usrp_probe --args="type=b200"

# Check UHD version
./uhd_config_info --version

# Run automated verification
cd .. && ./verify_b210.sh
```

## Common Usage

### Find B210 Serial Number
```bash
./uhd_find_devices | grep serial
```

### Check GPSDO Status
```bash
./uhd_usrp_probe --args="type=b200" | grep -A 10 "GPS"
```

### Test RX with FFT Display
```bash
./uhd_fft --freq 915e6 --samp-rate 10e6 --gain 50
```

### Record IQ Samples
```bash
./uhd_rx_cfile --freq 915e6 --samp-rate 10e6 --gain 50 --duration 10 output.cfile
```

## Notes

- These tools are compiled for ARM64 Linux
- Most tools require B210 to be connected via USB 3.0
- GUI tools (uhd_fft, uhd_siggen_gui) require X11 display
- For headless operation, use non-GUI alternatives (uhd_rx_nogui, uhd_siggen)

## Integration with Web Application

The web application's **ProductionHardwareManager** uses these tools internally:
- `uhd_find_devices` - Device detection on startup
- `uhd_usrp_probe` - Hardware capability detection
- Custom C++ daemons (sdr_streamer, iq_recorder) - Real-time FFT and recording

## Troubleshooting

**Device not found:**
- Check USB 3.0 connection
- Verify B210 power LED is lit
- Try different USB port
- Check USB permissions: `sudo usermod -a -G usb $USER`

**Permission denied:**
- Make tools executable: `chmod +x uhd_*`
- Add udev rules for USRP devices

**Library errors:**
- Install UHD libraries: `sudo apt install libuhd-dev`
- Check LD_LIBRARY_PATH includes UHD libraries

## References

- [UHD Manual](https://files.ettus.com/manual/)
- [B210 Product Page](https://www.ettus.com/all-products/ub210-kit/)
- [USRP Hardware Driver GitHub](https://github.com/EttusResearch/uhd)
