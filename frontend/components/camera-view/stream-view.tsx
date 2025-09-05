'use client';

import { useState, useEffect } from 'react';
import { CameraConfig } from '@/types';

interface StreamViewProps {
  camera: CameraConfig;
  annotated?: boolean;
}

export function StreamView({ camera, annotated = true }: StreamViewProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const baseUrl = `${process.env.NEXT_PUBLIC_API_URL}/cameras/${camera.camera_id}/stream?annotated=${annotated}`;
    const updateImage = () => {
      setImageUrl(`${baseUrl}&t=${new Date().getTime()}`);
    };
    updateImage();
    const intervalId = setInterval(updateImage, 100);
    return () => clearInterval(intervalId);
  }, [camera.camera_id, annotated]);

  const handleError = () => {
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className="grid place-items-center h-full w-full bg-muted">
        <p className="text-muted-foreground text-sm">Stream unavailable</p>
      </div>
    );
  }

  // --- FIX: Only render the image if the URL is set ---
  return imageUrl ? (
    <img
      src={imageUrl}
      alt={`Live stream from ${camera.name}`}
      className="w-full h-full object-contain"
      onError={handleError}
    />
  ) : (
    // Optional: Show a loading state
    <div className="grid place-items-center h-full w-full bg-muted">
      <p className="text-muted-foreground text-sm">Loading stream...</p>
    </div>
  );
}
