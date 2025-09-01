/**
 * Custom hook for line drawing functionality on a canvas element
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Point, LineDrawingState } from '@/types';

interface UseLineDrawingProps {
  maxPoints?: number;
  onComplete?: (points: Point[]) => void;
  initialPoints?: Point[];
}

export default function useLineDrawing({
  maxPoints = 2,
  onComplete,
  initialPoints = [],
}: UseLineDrawingProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<LineDrawingState>({
    points: initialPoints,
    isDrawing: false,
  });

  // Draw the current points on the canvas
  const drawPoints = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the points
    state.points.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();

      // Add index label
      ctx.font = '12px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText(String(index + 1), point.x - 4, point.y + 4);
    });

    // Draw the line if there are at least 2 points
    if (state.points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(state.points[0].x, state.points[0].y);
      for (let i = 1; i < state.points.length; i++) {
        ctx.lineTo(state.points[i].x, state.points[i].y);
      }
      ctx.strokeStyle = 'green';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [state.points]);

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (event: MouseEvent) => {
      if (state.points.length >= maxPoints) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const newPoints = [...state.points, { x, y }];
      setState((prev) => ({ ...prev, points: newPoints }));

      if (newPoints.length === maxPoints && onComplete) {
        onComplete(newPoints);
      }
    },
    [maxPoints, onComplete, state.points]
  );

  // Setup canvas event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [handleCanvasClick]);

  // Draw whenever points change
  useEffect(() => {
    drawPoints();
  }, [state.points, drawPoints]);

  // Reset the canvas
  const reset = useCallback(() => {
    setState({ points: [], isDrawing: false });
  }, []);

  // Update the canvas dimensions when it changes
  const updateCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    drawPoints();
  }, [drawPoints]);

  // Update canvas size on window resize
  useEffect(() => {
    window.addEventListener('resize', updateCanvasDimensions);
    updateCanvasDimensions();

    return () => {
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, [updateCanvasDimensions]);

  return {
    canvasRef,
    points: state.points,
    reset,
    isComplete: state.points.length === maxPoints,
    updateCanvasDimensions,
  };
}
