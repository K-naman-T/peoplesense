'use client';

import { useState, useEffect, useRef } from 'react';
import { CameraConfig } from '@/types';

interface StreamViewProps {
  camera: CameraConfig;
  annotated?: boolean;
}

export function StreamView({ camera, annotated = true }: StreamViewProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use refs to track current and next images for smooth transitions
  const currentImageRef = useRef<HTMLImageElement>(null);
  const nextImageRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Track indices outside useEffect so handleNextImageLoad can access them
  let currentIndex = 0;
  let nextIndex = 1;

  const baseUrl = `${process.env.NEXT_PUBLIC_API_URL}/cameras/${camera.camera_id}/stream?annotated=${annotated}`;

  const updateImage = () => {
    const timestamp = new Date().getTime();
    const newUrl = `${baseUrl}&t=${timestamp}`;

    // Load new image in the hidden layer
    if (nextImageRef.current) {
      nextImageRef.current.src = newUrl;
    }
  };

  // Function to swap the visible/hidden images once next image is loaded
  const handleNextImageLoad = () => {
    if (!imageContainerRef.current) return;

    // Swap z-index of images for smooth transition
    if (currentImageRef.current && nextImageRef.current) {
      currentImageRef.current.style.zIndex = (currentIndex % 2 === 0) ? '1' : '2';
      nextImageRef.current.style.zIndex = (currentIndex % 2 === 0) ? '2' : '1';
    }

    // Swap refs for next cycle
    [currentIndex, nextIndex] = [nextIndex, currentIndex];
    setIsLoading(false);

    // Immediately request the next frame
    updateImage();
  };

  useEffect(() => {
    // Initial frame request
    updateImage();

    // We don't need setInterval anymore since we request a new frame
    // as soon as the current one loads

    return () => {
      // No interval to clear
    };
  }, [camera.camera_id, annotated]);

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  if (hasError) {
    return (
      <div className="grid place-items-center h-full w-full bg-muted">
        <p className="text-muted-foreground text-sm">Stream unavailable</p>
      </div>
    );
  }

  return (
    <div 
      ref={imageContainerRef} 
      className="relative w-full h-full bg-muted"
    >
      {/* First image layer */}
      <img
        ref={currentImageRef}
        className="absolute top-0 left-0 w-full h-full object-contain"
        style={{ zIndex: 2 }}
        alt={`Live stream from ${camera.name}`}
        onError={handleError}
      />
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <p className="text-muted-foreground text-sm">Loading stream...</p>
        </div>
      )}
    </div>
  );
}
