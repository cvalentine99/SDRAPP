import { useEffect, useRef, useState } from "react";

interface Peak {
  frequency: number;
  power: number;
  x: number;
  y: number;
}

interface SpectrographDisplayWithDetectionProps {
  fftData: Float64Array | null;
  width?: number;
  height?: number;
  detectionThreshold?: number;
  onPeakClick?: (frequency: number, power: number) => void;
  centerFrequency?: number;
  sampleRate?: number;
}

export function SpectrographDisplayWithDetection({
  fftData,
  width = 1024,
  height = 200,
  detectionThreshold = -60,
  onPeakClick,
  centerFrequency = 915.0,
  sampleRate = 10.0,
}: SpectrographDisplayWithDetectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [detectedPeaks, setDetectedPeaks] = useState<Peak[]>([]);
  const [hoveredPeak, setHoveredPeak] = useState<Peak | null>(null);

  // Detect peaks in FFT data
  useEffect(() => {
    if (!fftData) return;

    const peaks: Peak[] = [];
    const fftSize = fftData.length;

    // Simple peak detection: find local maxima above threshold
    for (let i = 5; i < fftSize - 5; i++) {
      const powerDbm = fftData[i];
      
      if (powerDbm > detectionThreshold) {
        // Check if it's a local maximum
        let isLocalMax = true;
        for (let j = -5; j <= 5; j++) {
          if (j !== 0 && fftData[i + j] >= powerDbm) {
            isLocalMax = false;
            break;
          }
        }

        if (isLocalMax) {
          // Calculate frequency offset from center
          const freqOffset = ((i / fftSize) - 0.5) * sampleRate;
          const frequency = centerFrequency + freqOffset;
          
          const x = (i / fftSize) * width;
          const y = height - ((powerDbm + 100) / 100) * height;

          peaks.push({ frequency, power: powerDbm, x, y });
        }
      }
    }

    setDetectedPeaks(peaks);
  }, [fftData, detectionThreshold, width, height, centerFrequency, sampleRate]);

  // Render spectrograph with markers
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

    // Clear canvas
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(0, 0, width, height);

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
    if (fftData) {
      ctx.beginPath();
      ctx.strokeStyle = "#ff0099"; // Neon pink
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#ff0099";

      for (let i = 0; i < fftData.length; i++) {
        const x = (i / fftData.length) * width;
        const powerDbm = fftData[i];
        const y = height - ((powerDbm + 100) / 100) * height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Draw detection threshold line
    const thresholdY = height - ((detectionThreshold + 100) / 100) * height;
    ctx.strokeStyle = "rgba(255, 255, 0, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw peak markers
    detectedPeaks.forEach((peak) => {
      const isHovered = hoveredPeak === peak;
      
      // Draw marker circle
      ctx.beginPath();
      ctx.arc(peak.x, peak.y, isHovered ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? "#ffff00" : "#00ffff";
      ctx.shadowBlur = isHovered ? 15 : 10;
      ctx.shadowColor = isHovered ? "#ffff00" : "#00ffff";
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw vertical line from peak to bottom
      ctx.strokeStyle = isHovered ? "rgba(255, 255, 0, 0.5)" : "rgba(0, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(peak.x, peak.y);
      ctx.lineTo(peak.x, height);
      ctx.stroke();

      // Draw frequency label if hovered
      if (isHovered) {
        ctx.fillStyle = "#ffff00";
        ctx.font = "12px 'Rajdhani', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `${peak.frequency.toFixed(3)} MHz`,
          peak.x,
          peak.y - 15
        );
        ctx.fillText(
          `${peak.power.toFixed(1)} dBm`,
          peak.x,
          peak.y - 30
        );
      }
    });

    // Draw frequency labels
    ctx.fillStyle = "rgba(0, 255, 255, 0.7)";
    ctx.font = "10px 'Rajdhani', sans-serif";
    ctx.textAlign = "center";

    for (let i = 0; i <= 8; i++) {
      const x = (width / 8) * i;
      const freqOffset = ((i / 8) - 0.5) * sampleRate;
      const freq = centerFrequency + freqOffset;
      ctx.fillText(`${freq.toFixed(1)}`, x, height - 5);
    }

    // Draw power labels
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      const powerDb = -100 + (1 - i / 4) * 100;
      ctx.fillText(`${powerDb.toFixed(0)} dBm`, width - 5, y + 12);
    }
  }, [fftData, width, height, detectedPeaks, hoveredPeak, detectionThreshold, centerFrequency, sampleRate]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find nearest peak within 10px
    let nearestPeak: Peak | null = null;
    let minDistance = 10;

    detectedPeaks.forEach((peak) => {
      const distance = Math.sqrt(Math.pow(peak.x - x, 2) + Math.pow(peak.y - y, 2));
      if (distance < minDistance) {
        minDistance = distance;
        nearestPeak = peak;
      }
    });

    setHoveredPeak(nearestPeak);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredPeak && onPeakClick) {
      onPeakClick(hoveredPeak.frequency, hoveredPeak.power);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px`, cursor: hoveredPeak ? 'pointer' : 'default' }}
      className="w-full h-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredPeak(null)}
      onClick={handleClick}
    />
  );
}
