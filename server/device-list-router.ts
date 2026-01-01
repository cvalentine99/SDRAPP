import { z } from 'zod';
import { router, protectedProcedure } from './_core/trpc.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { drizzle } from 'drizzle-orm/mysql2';
import { deviceSelections } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);

const db = drizzle(process.env.DATABASE_URL || "");

/**
 * Device List Router
 * 
 * Handles SDR device enumeration and selection for both UHD and SoapySDR backends
 * Device selections are persisted to the database per user
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
   * Get currently selected device from database
   */
  getSelectedDevice: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Query database for user's selected device
    const [selection] = await db
      .select()
      .from(deviceSelections)
      .where(eq(deviceSelections.userId, userId))
      .limit(1);

    if (selection) {
      return {
        backend: (selection.backend || 'uhd') as 'uhd' | 'soapysdr',
        driver: selection.driver || 'b200',
        hardware: selection.hardware || 'Ettus B210',
        serial: selection.serial,
        args: selection.args || 'type=b200',
      };
    }

    // Return default device if no selection exists
    return {
      backend: 'uhd' as const,
      driver: 'b200',
      hardware: 'Ettus B210',
      serial: '',
      args: 'type=b200',
    };
  }),

  /**
   * Set selected device and persist to database
   */
  setSelectedDevice: protectedProcedure
    .input(
      z.object({
        backend: z.enum(['uhd', 'soapysdr']),
        driver: z.string().optional(),
        hardware: z.string().optional(),
        serial: z.string().optional(),
        args: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Parse serial from args if not provided
      let serial = input.serial || '';
      if (!serial && input.args) {
        const serialMatch = input.args.match(/serial=([^,]+)/);
        if (serialMatch) {
          serial = serialMatch[1];
        }
      }

      // Upsert device selection (insert or update on conflict)
      const [existing] = await db
        .select()
        .from(deviceSelections)
        .where(eq(deviceSelections.userId, userId))
        .limit(1);

      if (existing) {
        // Update existing selection
        await db
          .update(deviceSelections)
          .set({
            serial: serial || existing.serial,
            driver: input.driver || existing.driver,
            hardware: input.hardware || existing.hardware,
            args: input.args,
            backend: input.backend,
          })
          .where(eq(deviceSelections.userId, userId));
      } else {
        // Insert new selection
        await db.insert(deviceSelections).values({
          userId,
          serial: serial || 'unknown',
          driver: input.driver || null,
          hardware: input.hardware || null,
          args: input.args,
          backend: input.backend,
        });
      }

      console.log('[DEVICE-LIST] Device selection persisted:', { userId, ...input });
      
      return { success: true };
    }),
});
