import { useEffect, useRef, useCallback } from "react";

interface SpectrographDisplayProps {
  width?: number;
  height?: number;
  fftSize?: number;
  fftData?: number[] | null;
  /** dB range for Y-axis: [minDb, maxDb]. Default: [-120, -20] */
  dbRange?: [number, number];
  /** Center frequency in Hz for axis labels */
  centerFreq?: number;
  /** Sample rate in Hz for frequency span calculation */
  sampleRate?: number;
}

/**
 * SpectrographDisplay - Real-time spectrum analyzer visualization
 *
 * Renders FFT power spectrum as a line graph with frequency (X) and power (Y) axes.
 * Uses Canvas 2D for efficient polyline rendering.
 */
export function SpectrographDisplay({
  width = 1024,
  height = 200,
  fftSize = 2048,
  fftData = null,
  dbRange = [-120, -20],
  centerFreq = 915e6,
  sampleRate = 10e6,
}: SpectrographDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastFftDataRef = useRef<number[] | null>(null);

  // Normalize dBFS value to canvas Y coordinate
  const dbToY = useCallback(
    (db: number): number => {
      const [minDb, maxDb] = dbRange;
      const normalized = (db - minDb) / (maxDb - minDb);
      // Invert: higher power = lower Y coordinate
      return height - Math.max(0, Math.min(1, normalized)) * height;
    },
    [dbRange, height]
  );

  // Format frequency for display
  const formatFreq = useCallback((freqHz: number): string => {
    if (freqHz >= 1e9) {
      return `${(freqHz / 1e9).toFixed(3)} GHz`;
    } else if (freqHz >= 1e6) {
      return `${(freqHz / 1e6).toFixed(2)} MHz`;
    } else if (freqHz >= 1e3) {
      return `${(freqHz / 1e3).toFixed(1)} kHz`;
    }
    return `${freqHz.toFixed(0)} Hz`;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up canvas for high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Render loop
    const render = () => {
      // Clear canvas with semi-transparent black (trails effect)
      ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
      ctx.fillRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = "rgba(0, 255, 255, 0.1)";
      ctx.lineWidth = 1;

      // Horizontal grid lines (power levels)
      const [minDb, maxDb] = dbRange;
      const dbStep = (maxDb - minDb) / 4;
      for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical grid lines (frequency)
      for (let i = 0; i <= 8; i++) {
        const x = (width / 8) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw spectrum line using real FFT data
      const dataToRender = fftData || lastFftDataRef.current;

      if (dataToRender && dataToRender.length > 0) {
        lastFftDataRef.current = dataToRender;

        ctx.beginPath();
        ctx.strokeStyle = "#ff0099"; // Neon pink
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ff0099";

        const binWidth = width / dataToRender.length;

        for (let i = 0; i < dataToRender.length; i++) {
          const x = i * binWidth;
          const y = dbToY(dataToRender[i]);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // No data - draw flat noise floor line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 0, 153, 0.3)";
        ctx.lineWidth = 1;
        const noiseY = dbToY(minDb + 10); // 10 dB above noise floor
        ctx.moveTo(0, noiseY);
        ctx.lineTo(width, noiseY);
        ctx.stroke();

        // "No Signal" indicator
        ctx.fillStyle = "rgba(0, 255, 255, 0.5)";
        ctx.font = "12px 'Rajdhani', monospace";
        ctx.textAlign = "center";
        ctx.fillText("AWAITING SIGNAL", width / 2, height / 2);
      }

      // Draw frequency labels
      ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
      ctx.font = "10px 'Rajdhani', sans-serif";
      ctx.textAlign = "center";

      const halfSpan = sampleRate / 2;
      for (let i = 0; i <= 8; i++) {
        const x = (width / 8) * i;
        const freqOffset = ((i / 8) - 0.5) * sampleRate;
        const freq = centerFreq + freqOffset;

        // Show relative offset for inner labels, absolute for edges
        if (i === 0 || i === 8) {
          ctx.fillText(formatFreq(freq), x, height - 5);
        } else {
          const offsetMHz = freqOffset / 1e6;
          ctx.fillText(`${offsetMHz >= 0 ? "+" : ""}${offsetMHz.toFixed(1)}`, x, height - 5);
        }
      }

      // Draw power labels
      ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        const powerDb = maxDb - (i / 4) * (maxDb - minDb);
        ctx.fillText(`${powerDb.toFixed(0)} dB`, width - 5, y + 12);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height, fftSize, fftData, dbRange, dbToY, centerFreq, sampleRate, formatFreq]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="w-full h-full"
    />
  );
}
