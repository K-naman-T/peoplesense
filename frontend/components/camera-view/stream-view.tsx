'use client';

import { useState, useEffect, useRef } from 'react';
import { CameraConfig } from '@/types';
import camerasApi from '@/lib/api-client/cameras';

interface StreamViewProps {
  camera: CameraConfig;
  annotated?: boolean;
}

export function StreamView({ camera, annotated = true }: StreamViewProps) {
  const [hasError, setHasError] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [streamUrl, setStreamUrl] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [useSnapshot, setUseSnapshot] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Reset state when camera changes
  useEffect(() => {
    setHasError(false);
    setRetryCount(0);
    setUseSnapshot(false);
    setErrorMessage('');
  }, [camera.camera_id]);
  
  // Use setInterval to periodically update the image src
  useEffect(() => {
    const getImageUrl = () => {
      if (useSnapshot) {
        // Fall back to snapshot if streaming fails
        const snapshotUrl = camerasApi.getSnapshotUrl(camera.camera_id, annotated);
        return `${snapshotUrl}&t=${Date.now()}`; // Add timestamp to prevent caching
      } else {
        // Normal streaming path
        const baseUrl = `${process.env.NEXT_PUBLIC_API_URL}/cameras/${camera.camera_id}/stream`;
        return `${baseUrl}?annotated=${annotated}&t=${Date.now()}`;
      }
    };
    
    const updateImage = () => {
      // Only update if not in error state
      if (!hasError) {
        setStreamUrl(getImageUrl());
      }
    };
    
    // Update immediately, then periodically
    updateImage();
    const interval = setInterval(updateImage, useSnapshot ? 2000 : 200);
    
    return () => clearInterval(interval);
  }, [camera.camera_id, annotated, useSnapshot, hasError]);

  const handleImageError = () => {
    const url = imageRef.current?.src || 'unknown';
    
    // If we've already tried with a snapshot and it still fails, show an error
    if (useSnapshot) {
      setHasError(true);
      setErrorMessage(`Snapshot mode failed. Camera may be offline.`);
      console.error(`Camera feed unavailable: ${camera.name} (${url})`);
      return;
    }
    
    // If streaming fails but we haven't tried snapshot yet, try that
    if (retryCount >= 2) {
      console.warn(`Stream failed for ${camera.name}, falling back to snapshots (${url})`);
      setUseSnapshot(true);
      setRetryCount(0); // Reset retry count for snapshot mode
      return;
    }
    
    // Otherwise increment retry counter
    setRetryCount(prev => prev + 1);
    console.log(`Stream error #${retryCount + 1} for ${camera.name} (${url})`);
  };

  const handleImageLoad = () => {
    // Reset retry count on successful load
    if (retryCount > 0) {
      setRetryCount(0);
    }
  };

  const retryConnection = () => {
    setHasError(false);
    setRetryCount(0);
    setUseSnapshot(false);
    setErrorMessage('');
  };

  if (hasError) {
    return (
      <div className="grid place-items-center h-full w-full bg-muted">
        <div className="text-center p-4">
          <p className="text-muted-foreground mb-2">Stream unavailable</p>
          <p className="text-xs text-muted-foreground mb-4">{errorMessage || "Check if the camera is connected and configured correctly"}</p>
          <button 
            className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded"
            onClick={retryConnection}
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative w-full h-full bg-muted">
      {streamUrl && (
        <img
          ref={imageRef}
          src={streamUrl}
          className="h-full w-full object-contain"
          alt={`Live stream from ${camera.name}`}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      )}
      
      {useSnapshot && (
        <div className="absolute top-0 left-0 bg-yellow-500/70 text-white px-2 py-1 text-xs rounded-br">
          Snapshot Mode
        </div>
      )}
      
      <button 
        className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 text-xs rounded"
        onClick={() => setShowDebug(!showDebug)}
      >
        {showDebug ? "Hide Debug" : "Debug"}
      </button>
      
      {showDebug && (
        <div className="absolute top-4 left-4 bg-black/70 text-white p-2 rounded text-xs">
          <div>Camera ID: {camera.camera_id}</div>
          <div>Mode: {useSnapshot ? 'Snapshot' : 'Stream'}</div>
          <div>Retry Count: {retryCount}</div>
          {camera.line_points && camera.line_points.length === 2 && (
            <>
              <div className="mt-2">Line Points:</div>
              <div>P1: ({camera.line_points[0].x}%, {camera.line_points[0].y}%)</div>
              <div>P2: ({camera.line_points[1].x}%, {camera.line_points[1].y}%)</div>
            </>
          )}
        </div>
      )}
      
      {showDebug && camera.line_points && camera.line_points.length === 2 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <line
            x1={`${camera.line_points[0].x}%`}
            y1={`${camera.line_points[0].y}%`}
            x2={`${camera.line_points[1].x}%`}
            y2={`${camera.line_points[1].y}%`}
            stroke="yellow"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          <circle cx={`${camera.line_points[0].x}%`} cy={`${camera.line_points[0].y}%`} r="5" fill="yellow" />
          <circle cx={`${camera.line_points[1].x}%`} cy={`${camera.line_points[1].y}%`} r="5" fill="yellow" />
        </svg>
      )}
    </div>
  );
}
