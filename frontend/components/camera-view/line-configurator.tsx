'use client';

/**
 * LineConfigurator Component
 * A component for drawing and configuring counting lines on a camera feed
 */
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import camerasApi from '@/lib/api-client/cameras';
import { Point } from '@/types';
import { ImageOverlay } from './image-overlay'; // Import the new component

interface LineConfiguratorProps {
  cameraId: string;
  initialPoints?: Point[];
  onLineChange?: (points: Point[]) => void;
}

export function LineConfigurator({ 
  cameraId, 
  initialPoints = [], 
  onLineChange 
}: LineConfiguratorProps) {
  const [snapshotUrl, setSnapshotUrl] = useState(() => camerasApi.getSnapshotUrl(cameraId, false));
  const [points, setPoints] = useState<Point[]>(initialPoints || []);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Force reload the snapshot when component mounts
  useEffect(() => {
    const timestamp = Date.now();
    setSnapshotUrl(camerasApi.getSnapshotUrl(cameraId, false) + `&t=${timestamp}`);
  }, [cameraId]);

  // Update the handleClick function to account for letterboxing/pillarboxing
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Only accept clicks inside the actual image area
    if (x < 0 || x > 100 || y < 0 || y > 100) return;

    let newPoints = [...points];
    if (newPoints.length >= 2) {
      newPoints = [];
    }
    
    // Add the new point
    newPoints.push({ x, y });
    setPoints(newPoints);

    if (onLineChange) {
      onLineChange(newPoints);
    }
  };

  // Reset the line
  const resetLine = () => {
    setPoints([]);
    if (onLineChange) {
      onLineChange([]);
    }
  };

  return (
    <div className="relative h-full w-full bg-muted">
      <ImageOverlay
        src={snapshotUrl}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        onClick={handleClick}
        className="cursor-crosshair" // Apply cursor style to the clickable overlay
      >
        {() => (
          // This div is now ONLY for visualization, no event properties needed.
          <div className="relative w-full h-full">
            {/* Draw points */}
            {points.map((point, i) => (
              <div
                key={i}
                className="absolute w-4 h-4 rounded-full -translate-x-1/2 -translate-y-1/2 border-2 border-white pointer-events-none"
                style={{ left: `${point.x}%`, top: `${point.y}%`, backgroundColor: 'red' }}
              />
            ))}
            
            {/* Draw line (with the fix from above) */}
            {points.length === 2 && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <line x1={`${points[0].x}%`} y1={`${points[0].y}%`} x2={`${points[1].x}%`} y2={`${points[1].y}%`} stroke="white" strokeWidth="5" />
                <line x1={`${points[0].x}%`} y1={`${points[0].y}%`} x2={`${points[1].x}%`} y2={`${points[1].y}%`} stroke="red" strokeWidth="2" />
              </svg>
            )}

            {/* Instructions */}
            {points.length < 2 && (
              <div className="absolute top-2 left-2 bg-black/70 p-2 rounded-md text-white text-sm pointer-events-none">
                {points.length === 0 ? "Click to set the first point" : "Click to set the second point"}
              </div>
            )}
          </div>
        )}
      </ImageOverlay>

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
          Loading snapshot...
        </div>
      )}

      {/* Error message */}
      {hasError && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
          <div className="text-center p-4 bg-red-900/80 rounded-md">
            <p className="font-bold">Failed to load snapshot</p>
            <p className="text-sm mt-2">Check camera connection and backend API</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2">
        <Button onClick={resetLine} disabled={points.length === 0} variant="outline" size="sm">
          Reset Line
        </Button>
      </div>
    </div>
  );
}
