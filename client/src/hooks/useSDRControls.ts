import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * B210 hardware limits
 */
export const SDR_LIMITS = {
  FREQUENCY_MIN: 70e6, // 70 MHz
  FREQUENCY_MAX: 6e9, // 6 GHz
  SAMPLE_RATE_MIN: 200e3, // 200 kSPS
  SAMPLE_RATE_MAX: 61.44e6, // 61.44 MSPS
  GAIN_MIN: 0, // 0 dB
  GAIN_MAX: 76, // 76 dB
} as const;

/**
 * SDR control state
 */
export interface SDRControls {
  frequency: number;
  sampleRate: number;
  gain: number;
}

/**
 * SDR control actions
 */
export interface SDRControlActions {
  setFrequency: (freq: number) => void;
  setSampleRate: (rate: number) => void;
  setGain: (gain: number) => void;
  setControls: (controls: Partial<SDRControls>) => void;
  validateFrequency: (freq: number) => boolean;
  validateSampleRate: (rate: number) => boolean;
  validateGain: (gain: number) => boolean;
  formatFrequency: (freq: number) => string;
  formatSampleRate: (rate: number) => string;
}

/**
 * Options for useSDRControls hook
 */
export interface UseSDRControlsOptions {
  initialFrequency?: number;
  initialSampleRate?: number;
  initialGain?: number;
  showToastOnError?: boolean;
}

/**
 * Custom hook for managing SDR control state with validation
 * 
 * @example
 * ```tsx
 * const { frequency, sampleRate, gain, setFrequency, validateFrequency } = useSDRControls({
 *   initialFrequency: 915e6,
 *   initialSampleRate: 10e6,
 *   initialGain: 40,
 * });
 * ```
 */
export function useSDRControls(
  options: UseSDRControlsOptions = {}
): SDRControls & SDRControlActions {
  const {
    initialFrequency = 915e6, // 915 MHz default
    initialSampleRate = 10e6, // 10 MSPS default
    initialGain = 40, // 40 dB default
    showToastOnError = true,
  } = options;

  const [frequency, setFrequencyState] = useState(initialFrequency);
  const [sampleRate, setSampleRateState] = useState(initialSampleRate);
  const [gain, setGainState] = useState(initialGain);

  /**
   * Validate frequency is within B210 limits
   */
  const validateFrequency = useCallback(
    (freq: number): boolean => {
      if (freq < SDR_LIMITS.FREQUENCY_MIN) {
        if (showToastOnError) {
          toast.error(
            `Frequency must be at least ${SDR_LIMITS.FREQUENCY_MIN / 1e6} MHz`
          );
        }
        return false;
      }
      if (freq > SDR_LIMITS.FREQUENCY_MAX) {
        if (showToastOnError) {
          toast.error(
            `Frequency must be at most ${SDR_LIMITS.FREQUENCY_MAX / 1e9} GHz`
          );
        }
        return false;
      }
      return true;
    },
    [showToastOnError]
  );

  /**
   * Validate sample rate is within B210 limits
   */
  const validateSampleRate = useCallback(
    (rate: number): boolean => {
      if (rate < SDR_LIMITS.SAMPLE_RATE_MIN) {
        if (showToastOnError) {
          toast.error(
            `Sample rate must be at least ${SDR_LIMITS.SAMPLE_RATE_MIN / 1e3} kSPS`
          );
        }
        return false;
      }
      if (rate > SDR_LIMITS.SAMPLE_RATE_MAX) {
        if (showToastOnError) {
          toast.error(
            `Sample rate must be at most ${SDR_LIMITS.SAMPLE_RATE_MAX / 1e6} MSPS`
          );
        }
        return false;
      }
      return true;
    },
    [showToastOnError]
  );

  /**
   * Validate gain is within B210 limits
   */
  const validateGain = useCallback(
    (g: number): boolean => {
      if (g < SDR_LIMITS.GAIN_MIN) {
        if (showToastOnError) {
          toast.error(`Gain must be at least ${SDR_LIMITS.GAIN_MIN} dB`);
        }
        return false;
      }
      if (g > SDR_LIMITS.GAIN_MAX) {
        if (showToastOnError) {
          toast.error(`Gain must be at most ${SDR_LIMITS.GAIN_MAX} dB`);
        }
        return false;
      }
      return true;
    },
    [showToastOnError]
  );

  /**
   * Set frequency with validation
   */
  const setFrequency = useCallback(
    (freq: number) => {
      if (validateFrequency(freq)) {
        setFrequencyState(freq);
      }
    },
    [validateFrequency]
  );

  /**
   * Set sample rate with validation
   */
  const setSampleRate = useCallback(
    (rate: number) => {
      if (validateSampleRate(rate)) {
        setSampleRateState(rate);
      }
    },
    [validateSampleRate]
  );

  /**
   * Set gain with validation
   */
  const setGain = useCallback(
    (g: number) => {
      if (validateGain(g)) {
        setGainState(g);
      }
    },
    [validateGain]
  );

  /**
   * Set multiple controls at once
   */
  const setControls = useCallback(
    (controls: Partial<SDRControls>) => {
      if (controls.frequency !== undefined) {
        setFrequency(controls.frequency);
      }
      if (controls.sampleRate !== undefined) {
        setSampleRate(controls.sampleRate);
      }
      if (controls.gain !== undefined) {
        setGain(controls.gain);
      }
    },
    [setFrequency, setSampleRate, setGain]
  );

  /**
   * Format frequency for display
   */
  const formatFrequency = useCallback((freq: number): string => {
    const mhz = freq / 1e6;
    if (mhz >= 1000) {
      return `${(mhz / 1000).toFixed(3)} GHz`;
    }
    return `${mhz.toFixed(3)} MHz`;
  }, []);

  /**
   * Format sample rate for display
   */
  const formatSampleRate = useCallback((rate: number): string => {
    const msps = rate / 1e6;
    if (msps >= 1) {
      return `${msps.toFixed(2)} MSPS`;
    }
    return `${(rate / 1e3).toFixed(2)} kSPS`;
  }, []);

  return {
    frequency,
    sampleRate,
    gain,
    setFrequency,
    setSampleRate,
    setGain,
    setControls,
    validateFrequency,
    validateSampleRate,
    validateGain,
    formatFrequency,
    formatSampleRate,
  };
}
