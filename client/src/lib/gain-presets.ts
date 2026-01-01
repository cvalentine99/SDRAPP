/**
 * Gain Staging Presets for Ettus B210 SDR
 * 
 * These presets are optimized for common SDR use cases on the B210 hardware.
 * Each preset configures gain, sample rate, and bandwidth for optimal performance.
 */

export interface GainPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Overall gain in dB (0-76 for B210) */
  gain: number;
  /** Sample rate in SPS (samples per second) - API uses Hz */
  sampleRate: number;
  /** Sample rate in MSPS for display purposes */
  sampleRateMSPS: number;
  /** Bandwidth in MHz (optional, defaults to 80% of sample rate) */
  bandwidth?: number;
  /** Recommended frequency range description */
  frequencyRange: string;
  /** Use cases for this preset */
  useCases: string[];
  /** Color for UI accent */
  color: 'cyan' | 'pink' | 'yellow' | 'green' | 'purple';
}

/**
 * Pre-configured gain staging presets for common SDR scenarios
 */
export const GAIN_PRESETS: GainPreset[] = [
  {
    id: 'low-noise',
    name: 'Low Noise',
    description: 'Minimal gain for strong signals. Prevents ADC clipping and intermodulation.',
    icon: '🔇',
    gain: 20,
    sampleRate: 10e6,
    sampleRateMSPS: 10,
    bandwidth: 8,
    frequencyRange: 'All bands',
    useCases: [
      'Strong local transmitters',
      'FM broadcast reception',
      'Nearby amateur repeaters',
      'Preventing ADC overload'
    ],
    color: 'cyan'
  },
  {
    id: 'max-sensitivity',
    name: 'Max Sensitivity',
    description: 'Maximum gain for weak signals. Best noise figure but may clip on strong signals.',
    icon: '📡',
    gain: 70,
    sampleRate: 5e6,
    sampleRateMSPS: 5,
    bandwidth: 4,
    frequencyRange: 'All bands',
    useCases: [
      'Weak satellite signals',
      'Distant amateur stations',
      'Low-power IoT devices',
      'Radio astronomy'
    ],
    color: 'pink'
  },
  {
    id: 'wideband-scan',
    name: 'Wideband Scan',
    description: 'High sample rate for spectrum scanning. Moderate gain for balanced sensitivity.',
    icon: '📊',
    gain: 40,
    sampleRate: 56e6,
    sampleRateMSPS: 56,
    bandwidth: 40,
    frequencyRange: 'All bands',
    useCases: [
      'Spectrum surveying',
      'Signal hunting',
      'Interference detection',
      'Band activity monitoring'
    ],
    color: 'yellow'
  },
  {
    id: 'narrowband',
    name: 'Narrowband',
    description: 'Low sample rate for narrow signals. Optimal for voice and data modes.',
    icon: '🎯',
    gain: 50,
    sampleRate: 1e6,
    sampleRateMSPS: 1,
    bandwidth: 0.5,
    frequencyRange: 'All bands',
    useCases: [
      'SSB voice reception',
      'CW/Morse code',
      'RTTY and PSK31',
      'Narrow FM (12.5 kHz)'
    ],
    color: 'green'
  },
  {
    id: 'satellite',
    name: 'Satellite',
    description: 'Optimized for LEO satellite passes. High gain with moderate bandwidth.',
    icon: '🛰️',
    gain: 65,
    sampleRate: 2.4e6,
    sampleRateMSPS: 2.4,
    bandwidth: 2,
    frequencyRange: '137-438 MHz',
    useCases: [
      'NOAA weather satellites',
      'METEOR-M2 imagery',
      'ISS voice/SSTV',
      'Amateur satellites (SO-50, AO-91)'
    ],
    color: 'purple'
  },
  {
    id: 'ism-band',
    name: 'ISM Band',
    description: 'Configured for ISM band monitoring. Balanced for IoT and wireless devices.',
    icon: '📶',
    gain: 45,
    sampleRate: 4e6,
    sampleRateMSPS: 4,
    bandwidth: 3,
    frequencyRange: '433/868/915 MHz, 2.4 GHz',
    useCases: [
      'LoRa/LoRaWAN',
      'Zigbee monitoring',
      'WiFi analysis',
      'Bluetooth sniffing'
    ],
    color: 'cyan'
  },
  {
    id: 'aviation',
    name: 'Aviation',
    description: 'Optimized for airband reception. AM demodulation-ready settings.',
    icon: '✈️',
    gain: 35,
    sampleRate: 2e6,
    sampleRateMSPS: 2,
    bandwidth: 1.5,
    frequencyRange: '118-137 MHz',
    useCases: [
      'ATC communications',
      'ACARS decoding',
      'VHF airband scanning',
      'Airport monitoring'
    ],
    color: 'green'
  },
  {
    id: 'amateur-vhf',
    name: 'Amateur VHF',
    description: 'Tuned for 2m and 70cm amateur bands. FM and digital mode ready.',
    icon: '📻',
    gain: 45,
    sampleRate: 2e6,
    sampleRateMSPS: 2,
    bandwidth: 1.5,
    frequencyRange: '144-148 MHz, 420-450 MHz',
    useCases: [
      '2m FM repeaters',
      '70cm simplex',
      'APRS decoding',
      'DMR/D-STAR/Fusion'
    ],
    color: 'pink'
  }
];

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): GainPreset | undefined {
  return GAIN_PRESETS.find(preset => preset.id === id);
}

/**
 * Get presets suitable for a given frequency (in MHz)
 */
export function getPresetsForFrequency(frequencyMHz: number): GainPreset[] {
  // All presets work for all frequencies on B210, but some are more suitable
  const suitable: GainPreset[] = [];
  
  // Aviation band
  if (frequencyMHz >= 118 && frequencyMHz <= 137) {
    const aviation = getPresetById('aviation');
    if (aviation) suitable.push(aviation);
  }
  
  // Amateur VHF (2m)
  if (frequencyMHz >= 144 && frequencyMHz <= 148) {
    const amateur = getPresetById('amateur-vhf');
    if (amateur) suitable.push(amateur);
  }
  
  // Weather satellites
  if (frequencyMHz >= 137 && frequencyMHz <= 138) {
    const satellite = getPresetById('satellite');
    if (satellite) suitable.push(satellite);
  }
  
  // ISM 433 MHz
  if (frequencyMHz >= 430 && frequencyMHz <= 440) {
    const ism = getPresetById('ism-band');
    const amateur = getPresetById('amateur-vhf');
    if (ism) suitable.push(ism);
    if (amateur) suitable.push(amateur);
  }
  
  // ISM 868/915 MHz
  if ((frequencyMHz >= 863 && frequencyMHz <= 870) || (frequencyMHz >= 902 && frequencyMHz <= 928)) {
    const ism = getPresetById('ism-band');
    if (ism) suitable.push(ism);
  }
  
  // ISM 2.4 GHz
  if (frequencyMHz >= 2400 && frequencyMHz <= 2500) {
    const ism = getPresetById('ism-band');
    if (ism) suitable.push(ism);
  }
  
  // Always include general presets
  const lowNoise = getPresetById('low-noise');
  const maxSensitivity = getPresetById('max-sensitivity');
  const wideband = getPresetById('wideband-scan');
  
  if (lowNoise && !suitable.includes(lowNoise)) suitable.push(lowNoise);
  if (maxSensitivity && !suitable.includes(maxSensitivity)) suitable.push(maxSensitivity);
  if (wideband && !suitable.includes(wideband)) suitable.push(wideband);
  
  return suitable;
}

/**
 * Get color class for preset accent
 */
export function getPresetColorClass(color: GainPreset['color']): string {
  const colorMap: Record<GainPreset['color'], string> = {
    cyan: 'text-cyan-400 border-cyan-400/50 hover:border-cyan-400',
    pink: 'text-pink-400 border-pink-400/50 hover:border-pink-400',
    yellow: 'text-yellow-400 border-yellow-400/50 hover:border-yellow-400',
    green: 'text-green-400 border-green-400/50 hover:border-green-400',
    purple: 'text-purple-400 border-purple-400/50 hover:border-purple-400'
  };
  return colorMap[color];
}

/**
 * Get glow class for preset accent
 */
export function getPresetGlowClass(color: GainPreset['color']): string {
  const glowMap: Record<GainPreset['color'], string> = {
    cyan: 'shadow-[0_0_10px_rgba(34,211,238,0.3)]',
    pink: 'shadow-[0_0_10px_rgba(236,72,153,0.3)]',
    yellow: 'shadow-[0_0_10px_rgba(250,204,21,0.3)]',
    green: 'shadow-[0_0_10px_rgba(74,222,128,0.3)]',
    purple: 'shadow-[0_0_10px_rgba(192,132,252,0.3)]'
  };
  return glowMap[color];
}
