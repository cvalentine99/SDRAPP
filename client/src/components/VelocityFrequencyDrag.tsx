import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface VelocityFrequencyDragProps {
  frequency: number; // Current frequency in Hz
  onFrequencyChange: (frequency: number) => void;
  minFrequency?: number; // Min frequency in Hz (default 50 MHz)
  maxFrequency?: number; // Max frequency in Hz (default 6 GHz)
  sensitivity?: number; // Pixels per MHz (default 10)
  velocityMultiplier?: number; // Velocity-based acceleration (default 1.5)
  className?: string;
  children?: React.ReactNode;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  startFrequency: number;
  velocity: number;
  lastX: number;
  lastTime: number;
}

// Velocity decay animation frame ID
let animationFrameId: number | null = null;

export function VelocityFrequencyDrag({
  frequency,
  onFrequencyChange,
  minFrequency = 50e6, // 50 MHz
  maxFrequency = 6e9, // 6 GHz
  sensitivity = 10, // pixels per MHz
  velocityMultiplier = 1.5,
  className,
  children,
}: VelocityFrequencyDragProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startFrequency: frequency,
    velocity: 0,
    lastX: 0,
    lastTime: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragDirection, setDragDirection] = useState<"left" | "right" | null>(null);

  // Calculate frequency change from pixel delta
  const pixelToHz = useCallback(
    (pixels: number, velocity: number = 0) => {
      // Base change: pixels / sensitivity = MHz
      const baseMHz = pixels / sensitivity;

      // Apply velocity multiplier for fast drags
      const velocityFactor = 1 + Math.abs(velocity) * velocityMultiplier;

      return baseMHz * 1e6 * velocityFactor;
    },
    [sensitivity, velocityMultiplier]
  );

  // Clamp frequency to valid range
  const clampFrequency = useCallback(
    (freq: number) => {
      return Math.max(minFrequency, Math.min(maxFrequency, freq));
    },
    [minFrequency, maxFrequency]
  );

  // Apply momentum after drag ends
  const applyMomentum = useCallback(() => {
    const state = dragState.current;

    if (Math.abs(state.velocity) < 0.01) {
      animationFrameId = null;
      return;
    }

    // Apply velocity decay
    state.velocity *= 0.95;

    // Calculate frequency change from velocity
    const freqDelta = state.velocity * 1e6 * 10; // Scale velocity to meaningful frequency change
    const newFrequency = clampFrequency(frequency + freqDelta);

    if (newFrequency !== frequency) {
      onFrequencyChange(newFrequency);
    }

    // Continue animation
    animationFrameId = requestAnimationFrame(applyMomentum);
  }, [frequency, onFrequencyChange, clampFrequency]);

  // Mouse down handler
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Cancel any ongoing momentum
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      dragState.current = {
        isDragging: true,
        startX: e.clientX,
        startY: e.clientY,
        startFrequency: frequency,
        velocity: 0,
        lastX: e.clientX,
        lastTime: Date.now(),
      };
      setIsDragging(true);
      setDragDirection(null);

      // Prevent text selection during drag
      e.preventDefault();
    },
    [frequency]
  );

  // Mouse move handler
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const state = dragState.current;
      if (!state.isDragging) return;

      const now = Date.now();
      const deltaTime = now - state.lastTime;
      const deltaX = e.clientX - state.lastX;

      // Calculate velocity (pixels per millisecond)
      if (deltaTime > 0) {
        state.velocity = deltaX / deltaTime;
      }

      // Update last position and time
      state.lastX = e.clientX;
      state.lastTime = now;

      // Calculate total drag distance
      const totalDeltaX = e.clientX - state.startX;
      setDragDirection(totalDeltaX > 0 ? "right" : totalDeltaX < 0 ? "left" : null);

      // Calculate new frequency
      // Dragging left = increase frequency, dragging right = decrease
      const freqDelta = pixelToHz(-totalDeltaX, state.velocity);
      const newFrequency = clampFrequency(state.startFrequency + freqDelta);

      onFrequencyChange(newFrequency);
    },
    [pixelToHz, clampFrequency, onFrequencyChange]
  );

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    const state = dragState.current;
    if (!state.isDragging) return;

    state.isDragging = false;
    setIsDragging(false);
    setDragDirection(null);

    // Start momentum animation if velocity is significant
    if (Math.abs(state.velocity) > 0.1) {
      animationFrameId = requestAnimationFrame(applyMomentum);
    }
  }, [applyMomentum]);

  // Touch handlers for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      dragState.current = {
        isDragging: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startFrequency: frequency,
        velocity: 0,
        lastX: touch.clientX,
        lastTime: Date.now(),
      };
      setIsDragging(true);
    },
    [frequency]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const state = dragState.current;
      if (!state.isDragging || e.touches.length !== 1) return;

      const touch = e.touches[0];
      const now = Date.now();
      const deltaTime = now - state.lastTime;
      const deltaX = touch.clientX - state.lastX;

      if (deltaTime > 0) {
        state.velocity = deltaX / deltaTime;
      }

      state.lastX = touch.clientX;
      state.lastTime = now;

      const totalDeltaX = touch.clientX - state.startX;
      setDragDirection(totalDeltaX > 0 ? "right" : totalDeltaX < 0 ? "left" : null);

      const freqDelta = pixelToHz(-totalDeltaX, state.velocity);
      const newFrequency = clampFrequency(state.startFrequency + freqDelta);

      onFrequencyChange(newFrequency);
    },
    [pixelToHz, clampFrequency, onFrequencyChange]
  );

  const handleTouchEnd = useCallback(() => {
    handleMouseUp();
  }, [handleMouseUp]);

  // Attach global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative select-none touch-none",
        isDragging && "cursor-grabbing",
        !isDragging && "cursor-grab",
        className
      )}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {children}

      {/* Visual feedback during drag */}
      {isDragging && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className={cn(
              "absolute top-0 bottom-0 w-1 bg-primary transition-opacity",
              dragDirection === "left" ? "left-0 opacity-100" : "left-0 opacity-0"
            )}
          />
          <div
            className={cn(
              "absolute top-0 bottom-0 w-1 bg-primary transition-opacity",
              dragDirection === "right" ? "right-0 opacity-100" : "right-0 opacity-0"
            )}
          />

          {/* Direction indicators */}
          {dragDirection && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 px-3 py-1.5 rounded-full text-xs font-mono text-primary">
              {dragDirection === "left" ? "◄ Higher" : "Lower ►"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Hook for frequency wheel control
export function useFrequencyWheel(
  frequency: number,
  onFrequencyChange: (freq: number) => void,
  options: {
    minFrequency?: number;
    maxFrequency?: number;
    stepSize?: number; // Hz per wheel tick
  } = {}
) {
  const {
    minFrequency = 50e6,
    maxFrequency = 6e9,
    stepSize = 100e3, // 100 kHz default
  } = options;

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      // Determine step based on modifier keys
      let step = stepSize;
      if (e.shiftKey) step *= 10; // 1 MHz with shift
      if (e.ctrlKey || e.metaKey) step *= 100; // 10 MHz with ctrl/cmd

      // Scroll up = increase frequency, scroll down = decrease
      const direction = e.deltaY < 0 ? 1 : -1;
      const newFrequency = Math.max(
        minFrequency,
        Math.min(maxFrequency, frequency + direction * step)
      );

      onFrequencyChange(newFrequency);
    },
    [frequency, onFrequencyChange, minFrequency, maxFrequency, stepSize]
  );

  return {
    onWheel: handleWheel,
    wheelProps: {
      onWheel: (e: React.WheelEvent) => handleWheel(e.nativeEvent),
    },
  };
}

// Format frequency for display
export function formatFrequency(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(6)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}
