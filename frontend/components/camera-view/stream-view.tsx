'use client';

import { useState, useEffect, useRef } from 'react';
import { CameraConfig } from '@/types';

interface StreamViewProps {
  camera: CameraConfig;
  annotated?: boolean;
}

export function StreamView({ camera, annotated = true }: StreamViewProps) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const imageRef = useRef<HTMLImageElement>(null);

  // When camera or annotated changes, reset error state
  useEffect(() => {
    setHasError(false);
    setErrorMessage('');
  }, [camera.camera_id, annotated]);

  // Create stream URL - much simpler than before, no useMemo needed
  const streamUrl = camera.enabled
    ? `${process.env.NEXT_PUBLIC_API_URL}/cameras/${camera.camera_id}/mjpeg?annotated=${annotated}`
    : '';

  // Simple error handler
  const handleImageError = () => {
    setHasError(true);
    setErrorMessage(`Stream unavailable for ${camera.name}`);
    console.error(`Stream failed for ${camera.name}`);
  };

  // Clean up function to terminate connections on unmount
  useEffect(() => {
    return () => {
      if (imageRef.current) {
        // Force browser to abort the connection
        imageRef.current.src = '';
      }
    };
  }, []);

  if (!camera.enabled) {
    return (
      <div className="grid place-items-center h-full w-full bg-muted">
        <p className="text-muted-foreground">Camera disabled</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="grid place-items-center h-full w-full bg-muted">
        <div className="text-center p-4">
          <p className="text-muted-foreground mb-2">Stream unavailable</p>
          <p className="text-xs text-muted-foreground mb-4">{errorMessage}</p>
          <button
            className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded"
            onClick={() => setHasError(false)}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-muted">
      <img
        ref={imageRef}
        src={streamUrl}
        className="h-full w-full object-contain"
        alt={`Live stream from ${camera.name}`}
        onError={handleImageError}
      />
    
    </div>
  );
}
