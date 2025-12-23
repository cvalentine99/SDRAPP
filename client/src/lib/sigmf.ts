/**
 * SigMF (Signal Metadata Format) utilities
 * Specification: https://github.com/gnuradio/SigMF
 */

export interface SigMFGlobal {
  "core:datatype": string;
  "core:sample_rate": number;
  "core:version": string;
  "core:sha512"?: string;
  "core:offset"?: number;
  "core:description"?: string;
  "core:author"?: string;
  "core:meta_doi"?: string;
  "core:data_doi"?: string;
  "core:recorder"?: string;
  "core:license"?: string;
  "core:hw"?: string;
  "core:dataset"?: string;
  "core:trailing_bytes"?: number;
  "core:metadata_only"?: boolean;
  "core:num_channels"?: number;
  "core:extensions"?: Array<{ name: string; version: string; optional: boolean }>;
}

export interface SigMFCapture {
  "core:sample_start": number;
  "core:frequency"?: number;
  "core:datetime"?: string;
  "core:global_index"?: number;
  "core:header_bytes"?: number;
}

export interface SigMFAnnotation {
  "core:sample_start": number;
  "core:sample_count": number;
  "core:freq_lower_edge"?: number;
  "core:freq_upper_edge"?: number;
  "core:label"?: string;
  "core:comment"?: string;
  "core:generator"?: string;
}

export interface SigMFMetadata {
  global: SigMFGlobal;
  captures: SigMFCapture[];
  annotations?: SigMFAnnotation[];
}

export interface RecordingConfig {
  centerFrequency: string; // MHz
  sampleRate: string; // MSPS
  gain: number; // dB
  duration: number; // seconds
  author?: string;
  description?: string;
  license?: string;
  hardware?: string;
  location?: string;
  tags?: string;
}

/**
 * Generate SigMF-compliant metadata for a recording
 */
export function generateSigMFMetadata(config: RecordingConfig): SigMFMetadata {
  const sampleRateHz = parseFloat(config.sampleRate) * 1e6;
  const centerFrequencyHz = parseFloat(config.centerFrequency) * 1e6;
  const totalSamples = Math.floor(sampleRateHz * config.duration);

  const global: SigMFGlobal = {
    "core:datatype": "ci16_le", // Complex int16, little-endian (Ettus B210 format)
    "core:sample_rate": sampleRateHz,
    "core:version": "1.0.0",
    "core:num_channels": 1,
    "core:recorder": "Ettus SDR Web Application",
  };

  if (config.author) {
    global["core:author"] = config.author;
  }

  if (config.description) {
    global["core:description"] = config.description;
  }

  if (config.license) {
    global["core:license"] = config.license;
  }

  if (config.hardware) {
    global["core:hw"] = config.hardware;
  }

  const captures: SigMFCapture[] = [
    {
      "core:sample_start": 0,
      "core:frequency": centerFrequencyHz,
      "core:datetime": new Date().toISOString(),
    },
  ];

  const annotations: SigMFAnnotation[] = [];

  // Add location annotation if provided
  if (config.location) {
    annotations.push({
      "core:sample_start": 0,
      "core:sample_count": totalSamples,
      "core:label": "Recording Location",
      "core:comment": config.location,
    });
  }

  // Add tags annotation if provided
  if (config.tags) {
    annotations.push({
      "core:sample_start": 0,
      "core:sample_count": totalSamples,
      "core:label": "Tags",
      "core:comment": config.tags,
    });
  }

  return {
    global,
    captures,
    annotations: annotations.length > 0 ? annotations : undefined,
  };
}

/**
 * Export SigMF metadata as JSON string
 */
export function exportSigMFMetadata(metadata: SigMFMetadata): string {
  return JSON.stringify(metadata, null, 2);
}

/**
 * Download SigMF metadata as .sigmf-meta file
 */
export function downloadSigMFMetadata(metadata: SigMFMetadata, filename: string) {
  const json = exportSigMFMetadata(metadata);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/\.sigmf$/, ".sigmf-meta");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
