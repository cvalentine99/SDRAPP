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

/**
 * Get singleton hardware manager instance
 * Mode is determined by SDR_MODE environment variable:
 * - "demo" (default): Returns DemoHardwareManager with simulated data
 * - "production": Returns ProductionHardwareManager with real B210 hardware
 */
export function getHardwareManager(): IHardwareManager {
  if (!hardwareManagerInstance) {
    if (ENV.sdrMode === 'production') {
      console.log('[HW-FACTORY] Creating PRODUCTION hardware manager (real B210)');
      hardwareManagerInstance = new ProductionHardwareManager();
    } else {
      console.log('[HW-FACTORY] Creating DEMO hardware manager (simulated data)');
      hardwareManagerInstance = new DemoHardwareManager();
    }
  }
  return hardwareManagerInstance;
}

/**
 * Get current SDR mode
 */
export function getSDRMode(): 'demo' | 'production' {
  return ENV.sdrMode;
}

/**
 * Check if running in demo mode
 */
export function isDemoMode(): boolean {
  return ENV.sdrMode === 'demo';
}

/**
 * Check if running in production mode
 */
export function isProductionMode(): boolean {
  return ENV.sdrMode === 'production';
}

// Export for backward compatibility
export const hardwareManager = getHardwareManager();
