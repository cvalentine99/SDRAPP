/**
 * Hardware Capability Discovery Service
 * 
 * Queries actual SDR hardware capabilities via SoapySDR/UHD.
 * Falls back to static definitions when hardware is unavailable.
 * 
 * Discovery is performed ONCE at connection time and cached.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "./logger";
import {
  type HardwareCapabilities,
  DEVICE_CAPABILITIES,
  getDeviceCapabilities,
} from "../shared/sdr-capabilities";

const execAsync = promisify(exec);

/**
 * Capability cache (per device serial)
 */
const capabilityCache = new Map<string, HardwareCapabilities>();

/**
 * Parse SoapySDR device info output
 */
function parseSoapyDeviceInfo(output: string): Record<string, unknown> {
  const capabilities: Record<string, unknown> = {};
  
  try {
    // Parse frequency range
    const freqMatch = output.match(/Frequency Range:\s*([\d.]+)\s*MHz\s*to\s*([\d.]+)\s*MHz/i);
    if (freqMatch) {
      capabilities.frequencyRange = {
        min: parseFloat(freqMatch[1]) * 1e6,
        max: parseFloat(freqMatch[2]) * 1e6,
      };
    }

    // Parse sample rate range
    const sampleRateMatch = output.match(/Sample Rate Range:\s*([\d.]+)\s*to\s*([\d.]+)/i);
    if (sampleRateMatch) {
      capabilities.sampleRateRange = {
        min: parseFloat(sampleRateMatch[1]),
        max: parseFloat(sampleRateMatch[2]),
      };
    }

    // Parse gain range
    const gainMatch = output.match(/Gain Range:\s*([\d.-]+)\s*to\s*([\d.]+)\s*dB/i);
    if (gainMatch) {
      capabilities.gainRange = {
        min: parseFloat(gainMatch[1]),
        max: parseFloat(gainMatch[2]),
        step: 1,
      };
    }

    // Parse antennas
    const antennaMatch = output.match(/Antennas:\s*\[([^\]]+)\]/i);
    if (antennaMatch) {
      capabilities.antennas = antennaMatch[1].split(",").map(a => a.trim());
    }

    // Parse channel count
    const rxChannelMatch = output.match(/RX Channels:\s*(\d+)/i);
    if (rxChannelMatch) {
      capabilities.rxChannels = parseInt(rxChannelMatch[1], 10);
    }

    const txChannelMatch = output.match(/TX Channels:\s*(\d+)/i);
    if (txChannelMatch) {
      capabilities.txChannels = parseInt(txChannelMatch[1], 10);
    }
  } catch (error) {
    logger.hardware.warn("Failed to parse SoapySDR output", { error });
  }

  return capabilities;
}

/**
 * Parse UHD device info output
 */
function parseUHDDeviceInfo(output: string): Record<string, unknown> {
  const capabilities: Record<string, unknown> = {};
  
  try {
    // Parse frequency range from UHD output
    const freqMatch = output.match(/freq range:\s*([\d.]+)M\s*to\s*([\d.]+)G/i);
    if (freqMatch) {
      capabilities.frequencyRange = {
        min: parseFloat(freqMatch[1]) * 1e6,
        max: parseFloat(freqMatch[2]) * 1e9,
      };
    }

    // Parse gain range
    const gainMatch = output.match(/gain range:\s*([\d.]+)\s*to\s*([\d.]+)/i);
    if (gainMatch) {
      capabilities.gainRange = {
        min: parseFloat(gainMatch[1]),
        max: parseFloat(gainMatch[2]),
        step: 1,
      };
    }

    // Parse antennas
    const antennaMatch = output.match(/antennas:\s*([^\n]+)/i);
    if (antennaMatch) {
      capabilities.antennas = antennaMatch[1].split(/[,\s]+/).filter(a => a.length > 0);
    }
  } catch (error) {
    logger.hardware.warn("Failed to parse UHD output", { error });
  }

  return capabilities;
}

/**
 * Query SoapySDR for device capabilities
 */
async function querySoapySDR(deviceType: string, serial?: string): Promise<Record<string, unknown> | null> {
  try {
    // Build SoapySDR query command
    let args = `driver=${deviceType}`;
    if (serial) {
      args += `,serial=${serial}`;
    }

    const { stdout } = await execAsync(`SoapySDRUtil --probe="${args}"`, {
      timeout: 10000,
    });

    logger.hardware.info("SoapySDR probe successful", { deviceType, serial });
    return parseSoapyDeviceInfo(stdout);
  } catch (error) {
    logger.hardware.warn("SoapySDR probe failed", { deviceType, error: (error as Error).message });
    return null;
  }
}

/**
 * Query UHD for device capabilities
 */
async function queryUHD(deviceType: string, serial?: string): Promise<Record<string, unknown> | null> {
  try {
    // Build UHD query command
    let args = `type=${deviceType.replace("b", "b")}`;
    if (serial) {
      args += `,serial=${serial}`;
    }

    const { stdout } = await execAsync(`uhd_usrp_probe --args="${args}"`, {
      timeout: 15000,
    });

    logger.hardware.info("UHD probe successful", { deviceType, serial });
    return parseUHDDeviceInfo(stdout);
  } catch (error) {
    logger.hardware.warn("UHD probe failed", { deviceType, error: (error as Error).message });
    return null;
  }
}

/**
 * Discover device capabilities
 * 
 * Attempts to query actual hardware, falls back to static definitions.
 * Results are cached per device serial.
 */
export async function discoverCapabilities(
  deviceType: string,
  serial?: string
): Promise<HardwareCapabilities> {
  // Check cache first
  const cacheKey = `${deviceType}:${serial || "default"}`;
  const cached = capabilityCache.get(cacheKey);
  if (cached) {
    logger.hardware.debug("Using cached capabilities", { deviceType, serial });
    return cached;
  }

  // Get static definition as base
  const staticCaps = getDeviceCapabilities(deviceType);
  if (!staticCaps) {
    throw new Error(`Unknown device type: ${deviceType}`);
  }

  // For simulator, always use static definition
  if (deviceType === "simulator") {
    capabilityCache.set(cacheKey, staticCaps);
    return staticCaps;
  }

  // Try to query actual hardware
  let discoveredCaps: Record<string, unknown> | null = null;

  if (staticCaps.backend === "uhd") {
    discoveredCaps = await queryUHD(deviceType, serial);
  } else if (staticCaps.backend === "soapysdr") {
    discoveredCaps = await querySoapySDR(deviceType, serial);
  }

  // Merge discovered capabilities with static definition
  // Discovered values override static where available
  const finalCaps: HardwareCapabilities = { ...staticCaps };
  
  if (discoveredCaps) {
    const mutableCaps = finalCaps as unknown as Record<string, unknown>;
    if (discoveredCaps.frequencyRange) {
      mutableCaps.frequencyRange = discoveredCaps.frequencyRange;
    }
    if (discoveredCaps.sampleRateRange) {
      mutableCaps.sampleRateRange = discoveredCaps.sampleRateRange;
    }
    if (discoveredCaps.gainRange) {
      mutableCaps.gainRange = discoveredCaps.gainRange;
    }
    if (discoveredCaps.antennas) {
      mutableCaps.antennas = discoveredCaps.antennas;
    }
    if (discoveredCaps.rxChannels !== undefined) {
      mutableCaps.rxChannels = discoveredCaps.rxChannels;
    }
    if (discoveredCaps.txChannels !== undefined) {
      mutableCaps.txChannels = discoveredCaps.txChannels;
    }
  }

  // Cache the result
  capabilityCache.set(cacheKey, finalCaps);
  
  logger.hardware.info("Capability discovery complete", {
    deviceType,
    serial,
    usedHardwareQuery: discoveredCaps !== null,
  });

  return finalCaps;
}

/**
 * Clear capability cache
 */
export function clearCapabilityCache(): void {
  capabilityCache.clear();
  logger.hardware.info("Capability cache cleared");
}

/**
 * Get cached capabilities (without querying)
 */
export function getCachedCapabilities(deviceType: string, serial?: string): HardwareCapabilities | null {
  const cacheKey = `${deviceType}:${serial || "default"}`;
  return capabilityCache.get(cacheKey) || null;
}

/**
 * List all available devices (SoapySDR)
 */
export async function listAvailableDevices(): Promise<Array<{ driver: string; serial?: string; label: string }>> {
  const devices: Array<{ driver: string; serial?: string; label: string }> = [];

  try {
    // Try SoapySDR first
    const { stdout: soapyOutput } = await execAsync("SoapySDRUtil --find", {
      timeout: 10000,
    });

    // Parse SoapySDR device list
    const deviceRegex = /driver\s*=\s*(\w+)(?:,\s*serial\s*=\s*(\w+))?/gi;
    let match: RegExpExecArray | null;
    while ((match = deviceRegex.exec(soapyOutput)) !== null) {
      devices.push({
        driver: match[1],
        serial: match[2],
        label: `${match[1]}${match[2] ? ` (${match[2]})` : ""}`,
      });
    }
  } catch (error) {
    logger.hardware.warn("SoapySDR device enumeration failed", { error: (error as Error).message });
  }

  try {
    // Also try UHD
    const { stdout: uhdOutput } = await execAsync("uhd_find_devices", {
      timeout: 10000,
    });

    // Parse UHD device list
    const uhdRegex = /type:\s*(\w+)(?:.*serial:\s*(\w+))?/gi;
    let uhdMatch: RegExpExecArray | null;
    while ((uhdMatch = uhdRegex.exec(uhdOutput)) !== null) {
      // Avoid duplicates
      const existing = devices.find(d => d.driver === uhdMatch![1] && d.serial === uhdMatch![2]);
      if (!existing) {
        devices.push({
          driver: uhdMatch[1],
          serial: uhdMatch[2],
          label: `${uhdMatch[1]}${uhdMatch[2] ? ` (${uhdMatch[2]})` : ""} [UHD]`,
        });
      }
    }
  } catch (error) {
    logger.hardware.warn("UHD device enumeration failed", { error: (error as Error).message });
  }

  // Always include simulator
  devices.push({
    driver: "simulator",
    label: "Simulator (Demo Mode)",
  });

  return devices;
}
