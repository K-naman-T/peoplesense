'use client';

/**
 * LineConfigurator Component
 * A component for drawing and configuring counting lines on a camera feed
 */
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import camerasApi from '@/lib/api-client/cameras';
import { Point } from '@/types';

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
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- START: FIX ---
  // Correctly initialize the snapshot URL using the API client.
  // We use the function form of useState to ensure this is only called once.
  // We use `annotated=false` to draw on a clean image.
  const [snapshotUrl, setSnapshotUrl] = useState(() => camerasApi.getSnapshotUrl(cameraId, false));
  // --- END: FIX ---

  const [points, setPoints] = useState<Point[]>(initialPoints || []);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // Handle point clicks
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Get the image element inside the container
    const imageElement = container.querySelector('img');
    if (!imageElement) return;
    
    // Get the actual displayed dimensions of the image
    const imageRect = imageElement.getBoundingClientRect();
    
    // Calculate the letterboxing/pillarboxing offsets
    const offsetX = (rect.width - imageRect.width) / 2;
    const offsetY = (rect.height - imageRect.height) / 2;
    
    // Adjust click coordinates to account for letterboxing/pillarboxing
    const imageX = e.clientX - rect.left - offsetX;
    const imageY = e.clientY - rect.top - offsetY;
    
    // Calculate percentages based on the actual image dimensions (not container)
    const x = Math.round((imageX / imageRect.width) * 100);
    const y = Math.round((imageY / imageRect.height) * 100);
    
    // Only accept clicks inside the actual image area
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    
    let newPoints = [...points];
    if (newPoints.length >= 2) {
      newPoints = [];
    }
    newPoints.push({ x, y });
    setPoints(newPoints);

    if (onLineChange) {
      onLineChange(newPoints);
    }
  };
  
  // Notify parent component when points change
  useEffect(() => {
    if (onLineChange) {
      onLineChange(points);
    }
  }, [points, onLineChange]);

  return (
    <div className="relative h-full w-full bg-muted">
      <div 
        ref={containerRef}
        className="relative h-full w-full bg-muted cursor-crosshair"
        onClick={handleClick}
      >
        {/* Static snapshot image */}
        <img
          src={snapshotUrl}
          alt="Camera view"
          className="h-full w-full object-contain"
          onLoad={() => setIsLoading(false)}
          onError={(e) => {
            console.error("Failed to load camera feed in counting line configuration");
            setHasError(true);
            setIsLoading(false);
          }}
        />

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
        
        {/* Line drawing */}
        {points.map((point, i) => (
          <div
            key={i}
            className="absolute w-4 h-4 rounded-full bg-blue-500 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        ))}
        
        {points.length === 2 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line
              x1={`${points[0].x}%`}
              y1={`${points[0].y}%`}
              x2={`${points[1].x}%`}
              y2={`${points[1].y}%`}
              stroke="blue"
              strokeWidth="2"
            />
          </svg>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4">
        <p className="text-sm text-muted-foreground">
          Click two points on the image to draw a counting line. People crossing this line will be counted.
        </p>
      </div>
      
      {/* Keep only the Reset button */}
      <div className="absolute bottom-2 left-2 z-10">
        <Button 
          variant="outline" 
          onClick={(e) => {
            e.stopPropagation();
            setPoints([]);
            if (onLineChange) {
              onLineChange([]);
            }
          }} 
          disabled={points.length === 0}
          size="sm"
        >
          Reset Line
        </Button>
      </div>
    </div>
  );
}
