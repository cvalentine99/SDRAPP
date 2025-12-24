import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { hardware } from "./hardware";

// Signal forensics knowledge base for RAG
const SIGNAL_FORENSICS_CONTEXT = `
You are an RF signal intelligence assistant for an Ettus B210 SDR system. You help users analyze spectrum data, identify signals, and provide measurement recommendations.

## SDR System Capabilities
- Frequency Range: 50 MHz - 6 GHz
- Sample Rate: 200 kHz - 61.44 MSPS
- Gain Range: 0-76 dB
- Real-time FFT streaming at 60 FPS
- IQ recording with SigMF format
- Frequency scanning with peak detection

## Common Signal Types & Identification

### WiFi (2.4 GHz & 5 GHz)
- **Frequency**: 2.4-2.4835 GHz (channels 1-14), 5.15-5.85 GHz
- **Bandwidth**: 20/40/80/160 MHz channels
- **Modulation**: OFDM (BPSK, QPSK, 16-QAM, 64-QAM, 256-QAM)
- **Identification**: Periodic beacon frames every 100ms, wide bandwidth, bursty traffic
- **Recommended Settings**: Center freq 2.437 GHz (ch 6) or 5.5 GHz, 20 MSPS sample rate, 40 dB gain

### Bluetooth (2.4 GHz ISM)
- **Frequency**: 2.402-2.480 GHz (79 channels, 1 MHz spacing)
- **Bandwidth**: 1 MHz per channel
- **Modulation**: GFSK (Gaussian Frequency Shift Keying)
- **Identification**: Frequency hopping (1600 hops/sec), narrow bandwidth, constant activity
- **Recommended Settings**: Center freq 2.44 GHz, 10 MSPS sample rate, 40 dB gain

### FM Radio (88-108 MHz)
- **Frequency**: 88-108 MHz (US), 87.5-108 MHz (worldwide)
- **Bandwidth**: 200 kHz per station
- **Modulation**: Wideband FM (WBFM)
- **Identification**: Strong constant carriers, 200 kHz spacing, stereo pilot at 19 kHz
- **Recommended Settings**: Center freq 98 MHz, 2 MSPS sample rate, 30 dB gain

### LTE/4G Cellular
- **Frequency**: Multiple bands (700 MHz, 850 MHz, 1.9 GHz, 2.1 GHz, 2.6 GHz)
- **Bandwidth**: 1.4, 3, 5, 10, 15, 20 MHz
- **Modulation**: OFDMA downlink, SC-FDMA uplink (QPSK, 16-QAM, 64-QAM)
- **Identification**: Continuous downlink, synchronized frame structure, reference signals
- **Recommended Settings**: Center freq 1.96 GHz (Band 2), 20 MSPS sample rate, 40 dB gain

### 5G NR
- **Frequency**: Sub-6 GHz (600 MHz - 6 GHz), mmWave (24-40 GHz, beyond B210 range)
- **Bandwidth**: Up to 100 MHz (sub-6), 400 MHz (mmWave)
- **Modulation**: OFDM (QPSK, 16-QAM, 64-QAM, 256-QAM)
- **Identification**: Wider bandwidth than LTE, SSB (Synchronization Signal Block)
- **Recommended Settings**: Center freq 3.5 GHz (n78), 30 MSPS sample rate, 40 dB gain

### GPS L1
- **Frequency**: 1575.42 MHz
- **Bandwidth**: 2.046 MHz (C/A code)
- **Modulation**: BPSK (Binary Phase Shift Keying)
- **Identification**: Very weak signal (-130 dBm), spread spectrum, constant transmission
- **Recommended Settings**: Center freq 1.5754 GHz, 5 MSPS sample rate, 76 dB gain (max)

### ISM 915 MHz
- **Frequency**: 902-928 MHz (US)
- **Bandwidth**: Varies (LoRa: 125/250/500 kHz, Zigbee: 2 MHz)
- **Modulation**: Various (FSK, LoRa chirp, OFDM)
- **Identification**: Intermittent bursts, low power, various bandwidths
- **Recommended Settings**: Center freq 915 MHz, 10 MSPS sample rate, 50 dB gain

### Amateur Radio (Ham)
- **Frequency**: Multiple bands (HF: 1.8-30 MHz, VHF: 144-148 MHz, UHF: 420-450 MHz)
- **Bandwidth**: Varies (SSB: 2.7 kHz, FM: 15 kHz, Digital: 3-6 kHz)
- **Modulation**: SSB, FM, AM, CW (Morse), digital modes (FT8, PSK31)
- **Identification**: Voice/data transmissions, intermittent, varies by time of day
- **Recommended Settings**: Depends on band (e.g., 2m: 146 MHz, 5 MSPS, 40 dB)

## Signal Analysis Techniques

### Power Measurement
- Use FFT to measure signal power in dBm
- Noise floor typically -90 to -100 dBm
- Strong signals: -40 to -60 dBm
- Weak signals: -70 to -90 dBm
- Very weak (GPS): -130 dBm

### Bandwidth Estimation
- Measure -3dB bandwidth from FFT peak
- Count occupied bins × bin width
- Look for spectral mask/filtering

### Modulation Classification
- **Constant amplitude**: FM, FSK, MSK
- **Amplitude variation**: AM, QAM, OFDM
- **Frequency hopping**: Bluetooth, some military
- **Spread spectrum**: GPS, CDMA, LoRa

### Interference Detection
- Look for unexpected peaks in spectrum
- Check for harmonics (2f, 3f, 4f)
- Identify intermodulation products
- Monitor for adjacent channel interference

## Measurement Recommendations

### For Weak Signals
1. Increase gain (up to 76 dB)
2. Reduce sample rate to improve SNR
3. Use longer FFT size (4096+)
4. Average multiple FFT frames
5. Check antenna connection

### For Strong Signals
1. Reduce gain to avoid saturation
2. Check for clipping in time domain
3. Use attenuator if needed
4. Verify no ADC overload

### For Wideband Capture
1. Use maximum sample rate (61.44 MSPS)
2. Moderate gain (40 dB)
3. Short FFT size (1024) for time resolution
4. Record IQ for offline analysis

### For Narrowband Analysis
1. Reduce sample rate (1-5 MSPS)
2. Large FFT size (4096-8192)
3. Optimize gain for signal level
4. Use frequency scanner to find signals

## Troubleshooting

### No Signals Visible
- Check antenna connection
- Verify frequency range (50 MHz - 6 GHz)
- Increase gain
- Try known strong signal (FM radio)
- Check SDR mode (demo vs production)

### Saturated/Clipped Signals
- Reduce gain
- Check for nearby strong transmitters
- Use external attenuator
- Move antenna away from source

### Low SNR
- Increase gain
- Reduce sample rate
- Use better antenna
- Move to location with less interference
- Average multiple measurements

### Frequency Offset
- Check local oscillator calibration
- Verify sample rate accuracy
- Account for Doppler shift (moving sources)
- Use GPS disciplined oscillator (GPSDO)

## Best Practices

1. **Start with moderate settings**: 40 dB gain, 10 MSPS sample rate
2. **Scan before deep analysis**: Use frequency scanner to find signals of interest
3. **Record for offline analysis**: Save IQ data for detailed post-processing
4. **Document everything**: Note frequency, time, location, antenna, settings
5. **Verify with known signals**: Test with FM radio, WiFi before analyzing unknowns
6. **Monitor for overload**: Check for clipping, saturation, buffer overruns
7. **Use appropriate sample rate**: Match to signal bandwidth (Nyquist theorem)
8. **Consider legal restrictions**: Respect frequency allocations and privacy laws

## Example Queries You Can Help With

- "What signal is at 2.437 GHz?"
- "How do I identify WiFi vs Bluetooth?"
- "Recommended settings for analyzing LTE?"
- "Why is my spectrum showing clipping?"
- "How to find GPS signals?"
- "What's causing interference at 915 MHz?"
- "Best way to record a 20 MHz wide signal?"
- "How to measure signal bandwidth?"

Always provide specific, actionable recommendations with exact frequencies, sample rates, and gain settings.
`;

// Signal identification based on frequency
function identifySignalType(frequency: number): {
  type: string;
  description: string;
  confidence: number;
  suggestedQuestions: string[];
} {
  const freq = frequency / 1e6; // Convert to MHz

  // WiFi 2.4 GHz
  if (freq >= 2400 && freq <= 2500) {
    return {
      type: "WiFi 2.4 GHz",
      description: "IEEE 802.11 b/g/n/ax wireless network",
      confidence: 0.9,
      suggestedQuestions: [
        "What WiFi channels are active in this spectrum?",
        "How can I identify different WiFi access points?",
        "What's causing interference in the 2.4 GHz band?",
        "Recommended settings for WiFi packet capture?",
      ],
    };
  }

  // WiFi 5 GHz
  if (freq >= 5150 && freq <= 5850) {
    return {
      type: "WiFi 5 GHz",
      description: "IEEE 802.11 a/n/ac/ax wireless network",
      confidence: 0.9,
      suggestedQuestions: [
        "Which 5 GHz WiFi channels are in use?",
        "How to analyze WiFi 6 (802.11ax) signals?",
        "What's the difference between 20/40/80/160 MHz channels?",
        "Best sample rate for 5 GHz WiFi analysis?",
      ],
    };
  }

  // Bluetooth
  if (freq >= 2402 && freq <= 2480) {
    return {
      type: "Bluetooth",
      description: "Bluetooth Classic or BLE frequency hopping",
      confidence: 0.85,
      suggestedQuestions: [
        "How to detect Bluetooth frequency hopping?",
        "What's the difference between Bluetooth Classic and BLE?",
        "How many Bluetooth devices are nearby?",
        "Recommended settings for Bluetooth capture?",
      ],
    };
  }

  // FM Radio
  if (freq >= 88 && freq <= 108) {
    return {
      type: "FM Radio",
      description: "Commercial FM broadcast band",
      confidence: 0.95,
      suggestedQuestions: [
        "Which FM stations are strongest in my area?",
        "How to demodulate FM radio signals?",
        "What's the stereo pilot tone at 19 kHz?",
        "How to identify RDS (Radio Data System) signals?",
      ],
    };
  }

  // GPS L1
  if (freq >= 1574 && freq <= 1577) {
    return {
      type: "GPS L1",
      description: "GPS L1 C/A code (civilian)",
      confidence: 0.9,
      suggestedQuestions: [
        "Why is GPS signal so weak (-130 dBm)?",
        "How to acquire GPS satellites?",
        "What gain setting is needed for GPS?",
        "How to decode GPS navigation messages?",
      ],
    };
  }

  // LTE Band 2 (1900 MHz)
  if (freq >= 1850 && freq <= 1990) {
    return {
      type: "LTE Band 2",
      description: "4G LTE cellular (PCS band)",
      confidence: 0.8,
      suggestedQuestions: [
        "How to identify LTE cell towers?",
        "What's the bandwidth of this LTE signal?",
        "How to decode LTE reference signals?",
        "Recommended settings for LTE analysis?",
      ],
    };
  }

  // LTE Band 4 (AWS)
  if (freq >= 1710 && freq <= 2155) {
    return {
      type: "LTE Band 4",
      description: "4G LTE cellular (AWS band)",
      confidence: 0.8,
      suggestedQuestions: [
        "How many LTE carriers are active?",
        "What modulation is used in LTE downlink?",
        "How to measure LTE signal quality?",
        "What's the difference between FDD and TDD LTE?",
      ],
    };
  }

  // 5G n78 (3.5 GHz)
  if (freq >= 3300 && freq <= 3800) {
    return {
      type: "5G NR n78",
      description: "5G New Radio (mid-band)",
      confidence: 0.85,
      suggestedQuestions: [
        "How to identify 5G NR signals?",
        "What's the SSB (Synchronization Signal Block)?",
        "How wide are 5G channels?",
        "Recommended sample rate for 5G analysis?",
      ],
    };
  }

  // ISM 915 MHz
  if (freq >= 902 && freq <= 928) {
    return {
      type: "ISM 915 MHz",
      description: "Industrial, Scientific, Medical band (LoRa, Zigbee, etc.)",
      confidence: 0.7,
      suggestedQuestions: [
        "What devices use the 915 MHz ISM band?",
        "How to identify LoRa chirp signals?",
        "What's the difference between LoRa and Zigbee?",
        "How to analyze IoT device communications?",
      ],
    };
  }

  // ISM 433 MHz
  if (freq >= 433 && freq <= 435) {
    return {
      type: "ISM 433 MHz",
      description: "ISM band (remote controls, sensors)",
      confidence: 0.75,
      suggestedQuestions: [
        "What devices transmit at 433 MHz?",
        "How to decode remote control signals?",
        "What modulation is used for car key fobs?",
        "How to identify weather station transmissions?",
      ],
    };
  }

  // Amateur Radio 2m (VHF)
  if (freq >= 144 && freq <= 148) {
    return {
      type: "Amateur Radio 2m",
      description: "Ham radio VHF band",
      confidence: 0.8,
      suggestedQuestions: [
        "What ham radio modes are used on 2 meters?",
        "How to decode APRS packets?",
        "What's the calling frequency for 2m FM?",
        "How to identify digital modes like FT8?",
      ],
    };
  }

  // Amateur Radio 70cm (UHF)
  if (freq >= 420 && freq <= 450) {
    return {
      type: "Amateur Radio 70cm",
      description: "Ham radio UHF band",
      confidence: 0.8,
      suggestedQuestions: [
        "What's the difference between 2m and 70cm bands?",
        "How to find repeater frequencies?",
        "What digital modes are popular on 70cm?",
        "How to decode DMR or D-STAR signals?",
      ],
    };
  }

  // Default - unknown signal
  return {
    type: "Unknown Signal",
    description: `Signal at ${freq.toFixed(2)} MHz - analysis needed`,
    confidence: 0.3,
    suggestedQuestions: [
      "What frequency range should I scan?",
      "How to identify unknown signals?",
      "What are common signal types in this band?",
      "Recommended settings for signal discovery?",
    ],
  };
}

// Store for analysis history (in-memory for demo, use DB in production)
interface AnalysisRecord {
  id: string;
  timestamp: number;
  frequency: number;
  signalType: string;
  description: string;
  confidence: number;
  insights: string[];
  status: {
    temperature: number;
    gpsLock: boolean;
    pllLock: boolean;
  };
}

const analysisHistory: AnalysisRecord[] = [];
const MAX_HISTORY_SIZE = 100;

export const aiRouter = router({
  chat: publicProcedure
    .input(
      z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string(),
          })
        ),
        includeContext: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Get current SDR state for context
        const status = hardware.getStatus();
        const config = hardware.getConfig();

        const contextMessage = input.includeContext
          ? `\n\n## Current SDR State\n- Frequency: ${(config.frequency / 1e6).toFixed(3)} MHz\n- Sample Rate: ${(config.sampleRate / 1e6).toFixed(2)} MSPS\n- Gain: ${config.gain} dB\n- Temperature: ${status.temperature}°C\n- GPS Lock: ${status.gpsLock ? "Yes" : "No"}\n- PLL Lock: ${status.pllLock ? "Yes" : "No"}`
          : "";

        // Prepend system context
        const messages = [
          {
            role: "system" as const,
            content: SIGNAL_FORENSICS_CONTEXT + contextMessage,
          },
          ...input.messages,
        ];

        // Call LLM
        const response = await invokeLLM({
          messages,
          // Optionally add tools for advanced queries
          // tools: [...],
        });

        return {
          role: "assistant" as const,
          content: response.choices[0].message.content,
        };
      } catch (error) {
        console.error("AI chat error:", error);
        throw new Error(
          `Failed to process chat: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),

  analyzeSpectrum: publicProcedure.query(async () => {
    try {
      // Get current SDR configuration
      const config = hardware.getConfig();
      const status = hardware.getStatus();

      // Identify signal type based on frequency
      const signalAnalysis = identifySignalType(config.frequency);

      // Generate contextual insights
      const insights = [
        `Currently tuned to ${(config.frequency / 1e6).toFixed(3)} MHz`,
        `Sample rate: ${(config.sampleRate / 1e6).toFixed(2)} MSPS`,
        `Gain: ${config.gain} dB`,
      ];

      if (status.temperature > 60) {
        insights.push("⚠️ High temperature detected - consider cooling");
      }

      if (!status.gpsLock) {
        insights.push("📡 No GPS lock - frequency accuracy may be reduced");
      }

      if (!status.pllLock) {
        insights.push("⚠️ PLL not locked - check hardware connection");
      }

      // Save to history
      const record: AnalysisRecord = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        frequency: config.frequency,
        signalType: signalAnalysis.type,
        description: signalAnalysis.description,
        confidence: signalAnalysis.confidence,
        insights,
        status: {
          temperature: status.temperature,
          gpsLock: status.gpsLock,
          pllLock: status.pllLock,
        },
      };

      analysisHistory.unshift(record);
      if (analysisHistory.length > MAX_HISTORY_SIZE) {
        analysisHistory.pop();
      }

      return {
        id: record.id,
        frequency: config.frequency,
        sampleRate: config.sampleRate,
        gain: config.gain,
        signalType: signalAnalysis.type,
        description: signalAnalysis.description,
        confidence: signalAnalysis.confidence,
        suggestedQuestions: signalAnalysis.suggestedQuestions,
        insights,
        status: {
          temperature: status.temperature,
          gpsLock: status.gpsLock,
          pllLock: status.pllLock,
        },
      };
    } catch (error) {
      console.error("Spectrum analysis error:", error);
      throw new Error(
        `Failed to analyze spectrum: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }),

  // Get analysis history for comparison
  getHistory: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        frequencyFilter: z.number().optional(),
      })
    )
    .query(({ input }) => {
      let filtered = analysisHistory;

      // Optional frequency filter
      if (input.frequencyFilter !== undefined) {
        const targetFreq = input.frequencyFilter;
        const tolerance = 1e6; // 1 MHz tolerance
        filtered = analysisHistory.filter(
          (record) => Math.abs(record.frequency - targetFreq) <= tolerance
        );
      }

      return {
        records: filtered.slice(0, input.limit),
        total: filtered.length,
      };
    }),

  // Compare two analysis records
  compareAnalysis: publicProcedure
    .input(
      z.object({
        id1: z.string(),
        id2: z.string(),
      })
    )
    .query(({ input }) => {
      const record1 = analysisHistory.find((r) => r.id === input.id1);
      const record2 = analysisHistory.find((r) => r.id === input.id2);

      if (!record1 || !record2) {
        throw new Error("Analysis record not found");
      }

      // Calculate differences
      const frequencyDiff = record2.frequency - record1.frequency;
      const timeDiff = record2.timestamp - record1.timestamp;
      const temperatureDiff = record2.status.temperature - record1.status.temperature;
      const signalChanged = record1.signalType !== record2.signalType;

      return {
        record1,
        record2,
        comparison: {
          frequencyDiff,
          frequencyDiffMHz: frequencyDiff / 1e6,
          timeDiff,
          timeDiffMinutes: timeDiff / 60000,
          temperatureDiff,
          signalChanged,
          gpsLockChanged: record1.status.gpsLock !== record2.status.gpsLock,
          pllLockChanged: record1.status.pllLock !== record2.status.pllLock,
        },
      };
    }),

  // Export analysis report
  exportReport: publicProcedure
    .input(
      z.object({
        format: z.enum(["json", "markdown", "csv"]).default("json"),
        includeHistory: z.boolean().optional().default(false),
        limit: z.number().min(1).max(100).optional().default(10),
      })
    )
    .mutation(async ({ input }) => {
      const config = hardware.getConfig();
      const status = hardware.getStatus();
      const signalAnalysis = identifySignalType(config.frequency);

      const reportData = {
        generatedAt: new Date().toISOString(),
        currentAnalysis: {
          frequency: config.frequency,
          frequencyMHz: config.frequency / 1e6,
          sampleRate: config.sampleRate,
          sampleRateMSPS: config.sampleRate / 1e6,
          gain: config.gain,
          signalType: signalAnalysis.type,
          description: signalAnalysis.description,
          confidence: signalAnalysis.confidence,
          status: {
            temperature: status.temperature,
            gpsLock: status.gpsLock,
            pllLock: status.pllLock,
          },
        },
        history: input.includeHistory
          ? analysisHistory.slice(0, input.limit)
          : undefined,
      };

      switch (input.format) {
        case "json":
          return {
            format: "json",
            content: JSON.stringify(reportData, null, 2),
            filename: `sdr-analysis-${Date.now()}.json`,
            mimeType: "application/json",
          };

        case "markdown":
          const md = generateMarkdownReport(reportData);
          return {
            format: "markdown",
            content: md,
            filename: `sdr-analysis-${Date.now()}.md`,
            mimeType: "text/markdown",
          };

        case "csv":
          const csv = generateCSVReport(reportData);
          return {
            format: "csv",
            content: csv,
            filename: `sdr-analysis-${Date.now()}.csv`,
            mimeType: "text/csv",
          };

        default:
          throw new Error(`Unknown format: ${input.format}`);
      }
    }),

  // Clear history
  clearHistory: publicProcedure.mutation(() => {
    const count = analysisHistory.length;
    analysisHistory.length = 0;
    return { cleared: count };
  }),
});

// Generate markdown report
function generateMarkdownReport(data: {
  generatedAt: string;
  currentAnalysis: {
    frequency: number;
    frequencyMHz: number;
    sampleRate: number;
    sampleRateMSPS: number;
    gain: number;
    signalType: string;
    description: string;
    confidence: number;
    status: { temperature: number; gpsLock: boolean; pllLock: boolean };
  };
  history?: AnalysisRecord[];
}): string {
  const lines = [
    "# SDR Spectrum Analysis Report",
    "",
    `**Generated:** ${data.generatedAt}`,
    "",
    "## Current Analysis",
    "",
    "| Parameter | Value |",
    "|-----------|-------|",
    `| Frequency | ${data.currentAnalysis.frequencyMHz.toFixed(3)} MHz |`,
    `| Sample Rate | ${data.currentAnalysis.sampleRateMSPS.toFixed(2)} MSPS |`,
    `| Gain | ${data.currentAnalysis.gain} dB |`,
    `| Signal Type | ${data.currentAnalysis.signalType} |`,
    `| Description | ${data.currentAnalysis.description} |`,
    `| Confidence | ${(data.currentAnalysis.confidence * 100).toFixed(0)}% |`,
    "",
    "## Hardware Status",
    "",
    `- **Temperature:** ${data.currentAnalysis.status.temperature.toFixed(1)}°C`,
    `- **GPS Lock:** ${data.currentAnalysis.status.gpsLock ? "✅ Yes" : "❌ No"}`,
    `- **PLL Lock:** ${data.currentAnalysis.status.pllLock ? "✅ Yes" : "❌ No"}`,
    "",
  ];

  if (data.history && data.history.length > 0) {
    lines.push("## Analysis History", "");
    lines.push("| Time | Frequency | Signal Type | Confidence |");
    lines.push("|------|-----------|-------------|------------|");

    for (const record of data.history) {
      const time = new Date(record.timestamp).toLocaleString();
      lines.push(
        `| ${time} | ${(record.frequency / 1e6).toFixed(3)} MHz | ${record.signalType} | ${(record.confidence * 100).toFixed(0)}% |`
      );
    }
  }

  lines.push("", "---", "", "*Generated by Ettus B210 SDR Web Application*");

  return lines.join("\n");
}

// Generate CSV report
function generateCSVReport(data: {
  generatedAt: string;
  currentAnalysis: {
    frequency: number;
    frequencyMHz: number;
    sampleRate: number;
    sampleRateMSPS: number;
    gain: number;
    signalType: string;
    description: string;
    confidence: number;
    status: { temperature: number; gpsLock: boolean; pllLock: boolean };
  };
  history?: AnalysisRecord[];
}): string {
  const lines = [
    "timestamp,frequency_mhz,sample_rate_msps,gain_db,signal_type,confidence,temperature_c,gps_lock,pll_lock",
  ];

  // Add current analysis
  const curr = data.currentAnalysis;
  lines.push(
    [
      data.generatedAt,
      curr.frequencyMHz.toFixed(3),
      curr.sampleRateMSPS.toFixed(2),
      curr.gain,
      `"${curr.signalType}"`,
      curr.confidence.toFixed(2),
      curr.status.temperature.toFixed(1),
      curr.status.gpsLock,
      curr.status.pllLock,
    ].join(",")
  );

  // Add history
  if (data.history) {
    for (const record of data.history) {
      lines.push(
        [
          new Date(record.timestamp).toISOString(),
          (record.frequency / 1e6).toFixed(3),
          "N/A",
          "N/A",
          `"${record.signalType}"`,
          record.confidence.toFixed(2),
          record.status.temperature.toFixed(1),
          record.status.gpsLock,
          record.status.pllLock,
        ].join(",")
      );
    }
  }

  return lines.join("\n");
}
