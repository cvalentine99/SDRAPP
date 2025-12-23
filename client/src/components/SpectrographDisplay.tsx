import { useEffect, useRef } from "react";

interface SpectrographDisplayProps {
  width?: number;
  height?: number;
  fftSize?: number;
}

export function SpectrographDisplay({
  width = 1024,
  height = 200,
  fftSize = 2048,
}: SpectrographDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // One-time canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up canvas for high-DPI displays (one-time setup)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render loop
    const render = () => {
      // Reset transform to prevent compounding
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Clear canvas
      ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
      ctx.fillRect(0, 0, width, height);

      // Generate simulated FFT data (replace with real WebSocket data)
      const fftData = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        const freq = i / fftSize;
        let value = Math.random() * 0.1; // Noise floor

        // Add some simulated signals
        if (Math.abs(freq - 0.3) < 0.02) value += 0.6;
        if (Math.abs(freq - 0.6) < 0.01) value += 0.8;
        if (Math.abs(freq - 0.75) < 0.015) value += 0.4;

        fftData[i] = Math.min(1.0, value);
      }

      // Draw grid lines
      ctx.strokeStyle = "rgba(0, 255, 255, 0.1)";
      ctx.lineWidth = 1;

      // Horizontal grid lines (power levels)
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

      // Draw spectrum line
      ctx.beginPath();
      ctx.strokeStyle = "#ff0099"; // Neon pink
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ff0099";

      for (let i = 0; i < fftSize; i++) {
        const x = (i / fftSize) * width;
        const y = height - fftData[i] * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw frequency labels
      ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
      ctx.font = "10px 'Rajdhani', sans-serif";
      ctx.textAlign = "center";

      for (let i = 0; i <= 8; i++) {
        const x = (width / 8) * i;
        const freqMHz = (i / 8) * 20; // Assuming 20 MHz span
        ctx.fillText(`${freqMHz.toFixed(1)}`, x, height - 5);
      }

      // Draw power labels
      ctx.textAlign = "right";
      for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        const powerDb = -100 + (1 - i / 4) * 100; // -100 to 0 dBm range
        ctx.fillText(`${powerDb.toFixed(0)} dBm`, width - 5, y + 12);
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height, fftSize]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="w-full h-full"
    />
  );
}
