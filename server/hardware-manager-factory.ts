/**
 * hardware-manager-factory.ts - Factory for Demo/Production Hardware Managers
 * 
 * Returns the appropriate hardware manager based on SDR_MODE environment variable
 */

import { ENV } from './_core/env';
import { DemoHardwareManager } from './demo-hardware-manager';
import { ProductionHardwareManager } from './production-hardware-manager';
import { IHardwareManager } from './hardware-types';

let hardwareManagerInstance: IHardwareManager | null = null;
let currentMode: 'demo' | 'production' = ENV.sdrMode;

/**
 * Get singleton hardware manager instance
 * Mode is determined by currentMode (can be changed at runtime)
 * - "demo" (default): Returns DemoHardwareManager with simulated data
 * - "production": Returns ProductionHardwareManager with real B210 hardware
 */
export function getHardwareManager(): IHardwareManager {
  if (!hardwareManagerInstance) {
    if (currentMode === 'production') {
      console.log('[HW-FACTORY] Creating PRODUCTION hardware manager (real B210)');
      hardwareManagerInstance = new ProductionHardwareManager();
    } else {
      console.log('[HW-FACTORY] Creating DEMO hardware manager (simulated data)');
      hardwareManagerInstance = new DemoHardwareManager();
    }
    
    // Auto-start hardware manager
    hardwareManagerInstance.start().then(() => {
      console.log(`[HW-FACTORY] ${currentMode.toUpperCase()} hardware manager started`);
    }).catch((error) => {
      console.error('[HW-FACTORY] Failed to start hardware manager:', error);
    });
  }
  return hardwareManagerInstance;
}

/**
 * Switch SDR mode at runtime
 * Stops current hardware manager and creates new one with specified mode
 */
export async function switchSDRMode(newMode: 'demo' | 'production'): Promise<void> {
  if (currentMode === newMode) {
    console.log(`[HW-FACTORY] Already in ${newMode} mode, no change needed`);
    return;
  }

  console.log(`[HW-FACTORY] Switching from ${currentMode} to ${newMode} mode`);

  // Stop current hardware manager
  if (hardwareManagerInstance) {
    try {
      await hardwareManagerInstance.stop();
      console.log('[HW-FACTORY] Stopped current hardware manager');
    } catch (error) {
      console.error('[HW-FACTORY] Error stopping hardware manager:', error);
    }
    hardwareManagerInstance = null;
  }

  // Update mode
  currentMode = newMode;

  // Create new hardware manager
  if (newMode === 'production') {
    console.log('[HW-FACTORY] Creating PRODUCTION hardware manager (real B210)');
    hardwareManagerInstance = new ProductionHardwareManager();
  } else {
    console.log('[HW-FACTORY] Creating DEMO hardware manager (simulated data)');
    hardwareManagerInstance = new DemoHardwareManager();
  }

  // Auto-start new hardware manager
  await hardwareManagerInstance.start();
  console.log(`[HW-FACTORY] Successfully switched to ${newMode} mode and started`);
}

/**
 * Get current SDR mode
 */
export function getSDRMode(): 'demo' | 'production' {
  return currentMode;
}

/**
 * Check if running in demo mode
 */
export function isDemoMode(): boolean {
  return currentMode === 'demo';
}

/**
 * Check if running in production mode
 */
export function isProductionMode(): boolean {
  return currentMode === 'production';
}

// Export for backward compatibility
export const hardwareManager = getHardwareManager();
