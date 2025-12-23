export interface ColorStop {
  position: number; // 0-1
  color: string; // hex color
}

export interface ColorMap {
  name: string;
  stops: ColorStop[];
}

export const COLOR_MAP_PRESETS: ColorMap[] = [
  {
    name: "Viridis",
    stops: [
      { position: 0.0, color: "#440154" },
      { position: 0.25, color: "#31688e" },
      { position: 0.5, color: "#35b779" },
      { position: 0.75, color: "#fde724" },
      { position: 1.0, color: "#ffff00" },
    ],
  },
  {
    name: "Plasma",
    stops: [
      { position: 0.0, color: "#0d0887" },
      { position: 0.25, color: "#7e03a8" },
      { position: 0.5, color: "#cc4778" },
      { position: 0.75, color: "#f89540" },
      { position: 1.0, color: "#f0f921" },
    ],
  },
  {
    name: "Inferno",
    stops: [
      { position: 0.0, color: "#000004" },
      { position: 0.25, color: "#57106e" },
      { position: 0.5, color: "#bc3754" },
      { position: 0.75, color: "#f98e09" },
      { position: 1.0, color: "#fcffa4" },
    ],
  },
  {
    name: "Grayscale",
    stops: [
      { position: 0.0, color: "#000000" },
      { position: 0.25, color: "#404040" },
      { position: 0.5, color: "#808080" },
      { position: 0.75, color: "#c0c0c0" },
      { position: 1.0, color: "#ffffff" },
    ],
  },
  {
    name: "Hot/Cold",
    stops: [
      { position: 0.0, color: "#0000ff" }, // Blue (cold)
      { position: 0.25, color: "#00ffff" }, // Cyan
      { position: 0.5, color: "#00ff00" }, // Green
      { position: 0.75, color: "#ffff00" }, // Yellow
      { position: 1.0, color: "#ff0000" }, // Red (hot)
    ],
  },
  {
    name: "Cyberpunk (Default)",
    stops: [
      { position: 0.0, color: "#0a0a0a" }, // Deep black
      { position: 0.25, color: "#1a4d6d" }, // Dark cyan
      { position: 0.5, color: "#00d9ff" }, // Electric cyan
      { position: 0.75, color: "#ff1493" }, // Neon pink
      { position: 1.0, color: "#ff69b4" }, // Hot pink
    ],
  },
];

/**
 * Convert a color map to a CSS linear gradient string
 */
export function colorMapToGradient(colorMap: ColorMap): string {
  const stops = colorMap.stops
    .map((stop) => `${stop.color} ${(stop.position * 100).toFixed(1)}%`)
    .join(", ");
  return `linear-gradient(to right, ${stops})`;
}

/**
 * Interpolate a color from a color map based on a value (0-1)
 */
export function interpolateColor(colorMap: ColorMap, value: number): string {
  // Clamp value to 0-1
  value = Math.max(0, Math.min(1, value));

  // Find the two stops to interpolate between
  let lowerStop = colorMap.stops[0];
  let upperStop = colorMap.stops[colorMap.stops.length - 1];

  for (let i = 0; i < colorMap.stops.length - 1; i++) {
    if (
      value >= colorMap.stops[i].position &&
      value <= colorMap.stops[i + 1].position
    ) {
      lowerStop = colorMap.stops[i];
      upperStop = colorMap.stops[i + 1];
      break;
    }
  }

  // Calculate interpolation factor
  const range = upperStop.position - lowerStop.position;
  const factor = range === 0 ? 0 : (value - lowerStop.position) / range;

  // Parse hex colors
  const lower = hexToRgb(lowerStop.color);
  const upper = hexToRgb(upperStop.color);

  // Interpolate RGB values
  const r = Math.round(lower.r + (upper.r - lower.r) * factor);
  const g = Math.round(lower.g + (upper.g - lower.g) * factor);
  const b = Math.round(lower.b + (upper.b - lower.b) * factor);

  return rgbToHex(r, g, b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
