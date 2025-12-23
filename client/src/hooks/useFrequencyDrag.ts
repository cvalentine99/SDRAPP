import { useEffect, useRef, useState } from "react";

interface UseFrequencyDragOptions {
  initialValue: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

/**
 * Velocity-aware frequency dragging hook
 * Drag speed determines step size:
 * - Slow (< 2 px/frame): 0.1 MHz
 * - Medium (2-10 px/frame): 1 MHz
 * - Fast (> 10 px/frame): 10 MHz
 */
export function useFrequencyDrag({
  initialValue,
  onChange,
  min = 0,
  max = 6000,
}: UseFrequencyDragOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const lastY = useRef(0);
  const currentValue = useRef(initialValue);
  const velocityHistory = useRef<number[]>([]);

  useEffect(() => {
    currentValue.current = initialValue;
  }, [initialValue]);

  const calculateStepSize = (velocity: number): number => {
    const absVelocity = Math.abs(velocity);
    if (absVelocity < 2) return 0.1; // Slow drag
    if (absVelocity < 10) return 1.0; // Medium drag
    return 10.0; // Fast drag
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    lastY.current = e.clientY;
    velocityHistory.current = [];
    document.body.style.cursor = "ns-resize";
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = lastY.current - e.clientY;
      lastY.current = e.clientY;

      // Track velocity (pixels per frame)
      velocityHistory.current.push(Math.abs(deltaY));
      if (velocityHistory.current.length > 5) {
        velocityHistory.current.shift();
      }

      // Calculate average velocity
      const avgVelocity =
        velocityHistory.current.reduce((a, b) => a + b, 0) /
        velocityHistory.current.length;

      const stepSize = calculateStepSize(avgVelocity);
      const direction = deltaY > 0 ? 1 : -1;

      let newValue = currentValue.current + direction * stepSize;
      newValue = Math.max(min, Math.min(max, newValue));
      newValue = Math.round(newValue * 10) / 10; // Round to 1 decimal

      if (newValue !== currentValue.current) {
        currentValue.current = newValue;
        onChange(newValue);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onChange, min, max]);

  return {
    isDragging,
    handleMouseDown,
  };
}
