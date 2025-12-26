import { z } from 'zod';
import { router, protectedProcedure } from './_core/trpc.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Device List Router
 * 
 * Handles SDR device enumeration and selection for both UHD and SoapySDR backends
 */

const DeviceSchema = z.object({
  backend: z.enum(['uhd', 'soapysdr']),
  driver: z.string(),
  hardware: z.string(),
  serial: z.string(),
  args: z.string(),
});

export const deviceListRouter = router({
  /**
   * List all available SDR devices (UHD + SoapySDR)
   */
  listDevices: protectedProcedure.query(async () => {
    const isProduction = process.env.SDR_MODE === 'production';

    if (!isProduction) {
      // Demo mode: return mock devices
      return {
        devices: [
          {
            backend: 'uhd' as const,
            driver: 'b200',
            hardware: 'Ettus B210 (Demo)',
            serial: 'DEMO12345',
            args: 'type=b200,serial=DEMO12345',
          },
          {
            backend: 'soapysdr' as const,
            driver: 'rtlsdr',
            hardware: 'RTL-SDR Blog V3 (Demo)',
            serial: 'DEMO67890',
            args: 'driver=rtlsdr,serial=DEMO67890',
          },
          {
            backend: 'soapysdr' as const,
            driver: 'hackrf',
            hardware: 'HackRF One (Demo)',
            serial: 'DEMO11111',
            args: 'driver=hackrf,serial=DEMO11111',
          },
        ],
      };
    }

    // Production mode: enumerate real devices
    try {
      const { stdout } = await execAsync('device_enumerator', {
        timeout: 5000,
        env: process.env,
      });

      const result = JSON.parse(stdout);
      const devices = z.array(DeviceSchema).parse(result.devices);

      return { devices };
    } catch (error) {
      console.error('[DEVICE-LIST] Enumeration failed:', error);
      
      // Fallback: return empty list
      return { devices: [] };
    }
  }),

  /**
   * Get currently selected device
   */
  getSelectedDevice: protectedProcedure.query(async () => {
    // TODO: Store selected device in database
    // For now, return default device
    return {
      backend: 'uhd' as const,
      driver: 'b200',
      hardware: 'Ettus B210',
      serial: '',
      args: 'type=b200',
    };
  }),

  /**
   * Set selected device
   */
  setSelectedDevice: protectedProcedure
    .input(
      z.object({
        backend: z.enum(['uhd', 'soapysdr']),
        args: z.string(),
      })
    )
    .mutation(async ({ input }: { input: { backend: 'uhd' | 'soapysdr'; args: string } }) => {
      // TODO: Store in database
      console.log('[DEVICE-LIST] Selected device:', input);
      
      return { success: true };
    }),
});
