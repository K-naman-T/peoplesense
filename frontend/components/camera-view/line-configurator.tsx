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
  streamUrl?: string; // Optional direct stream URL
  initialPoints?: Point[];
  onComplete?: () => void;
  onLineChange?: (points: Point[]) => void; // Add callback for parent component to get points
}

export function LineConfigurator({ 
  cameraId, 
  streamUrl: propStreamUrl, 
  initialPoints = [], 
  onComplete, 
  onLineChange 
}: LineConfiguratorProps) {
  const [streamUrl, setStreamUrl] = useState<string>(propStreamUrl || '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get stream URL for the background image if not provided directly
  useEffect(() => {
    if (!propStreamUrl) {
      setStreamUrl(camerasApi.getStreamUrl(cameraId, false));
    }
  }, [cameraId, propStreamUrl]);

  const [points, setPoints] = useState<Point[]>(initialPoints || []);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Fetch a fresh snapshot when the component loads
  const [snapshotUrl, setSnapshotUrl] = useState(`${streamUrl}&t=${Date.now()}`);
  
  // Handle point clicks
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || saving) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * 100);
    const y = Math.round((e.clientY - rect.top) / rect.height * 100);
    
    // If we have 2 points already, reset
    let newPoints = [...points];
    if (newPoints.length >= 2) {
      newPoints = [];
    }
    
    // Add the new point
    newPoints.push({ x, y });
    setPoints(newPoints);
    
    // Update parent component
    if (onLineChange) {
      onLineChange(newPoints);
    }
    
    // If we now have 2 points, automatically save the line
    if (newPoints.length === 2) {
      handleSave();
    }
  };
  
  // Notify parent component when points change
  useEffect(() => {
    if (onLineChange) {
      onLineChange(points);
    }
  }, [points, onLineChange]);

  // Handle save button click
  const handleSave = async () => {
    if (points.length !== 2) {
      setError('Please draw a line by selecting two points on the image');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const lineDefinition = {
        camera_id: cameraId,
        points: points,
      };

      // Save the line configuration
      const success = await camerasApi.setCountingLine(lineDefinition);
      
      if (success) {
        // Optional: Show a brief success message
        setStatusMessage("Line saved successfully");
        setTimeout(() => setStatusMessage(""), 3000);
        
        if (onComplete) {
          onComplete();
        }
      } else {
        setError('Failed to save line configuration. Please try again.');
      }
    } catch (err) {
      console.error('Error saving line configuration:', err);
      setError('Failed to save line configuration please try again');
    } finally {
      setSaving(false);
    }
  };

  // Add a console.log before the save button to check state
  console.log("Points length:", points.length, "Saving:", saving, "Error:", error);
  
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

      {/* Status message for feedback */}
      {statusMessage && (
        <div className="absolute bottom-4 right-4 bg-green-600/80 text-white px-4 py-2 rounded shadow">
          {statusMessage}
        </div>
      )}
      
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
          disabled={points.length === 0 || saving}
          size="sm"
        >
          Reset Line
        </Button>
      </div>
      
      {/* Show saving indicator */}
      {saving && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div className="bg-background p-4 rounded shadow">Saving line...</div>
        </div>
      )}
    </div>
  );
}
