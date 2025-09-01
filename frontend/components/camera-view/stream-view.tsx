'use client';

/**
 * StreamView Component
 * A component for displaying a live camera stream
 */
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CameraConfig } from '@/types';
import camerasApi from '@/lib/api-client/cameras';

interface StreamViewProps {
  camera: CameraConfig;
  showControls?: boolean;
}

export function StreamView({ camera, showControls = true }: StreamViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const [annotated, setAnnotated] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now()); // Used to force refresh stream

  // Get the stream URL based on annotated preference
  const streamUrl = camerasApi.getStreamUrl(camera.camera_id, annotated);

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  // Handle stream error
  const handleStreamError = () => {
    setStreamError(true);
  };

  // Retry loading the stream
  const retryStream = () => {
    setStreamError(false);
    setStreamKey(Date.now()); // Force refresh by changing key
  };

  // Update URL when annotated changes
  useEffect(() => {
    setStreamError(false);
    setStreamKey(Date.now());
  }, [annotated]);

  useEffect(() => {
    // For MJPEG streams, directly setting the src is the most reliable method
    if (imgRef.current && camera.camera_id) {
      imgRef.current.src = `${apiUrl}/cameras/${camera.camera_id}/stream?annotated=${annotated}`;
    }

    // Clean up function
    return () => {
      if (imgRef.current) {
        imgRef.current.src = '';
      }
    };
  }, [camera.camera_id, annotated, apiUrl]);

  return (
    <div className={`stream-view ${fullscreen ? 'fixed inset-0 z-50 bg-black' : 'relative w-full'}`}>
      <Card className={`h-full overflow-hidden ${fullscreen ? 'rounded-none' : ''}`}>
        <div className="relative aspect-video w-full">
          {camera.enabled ? (
            streamError ? (
              <div className="flex h-full w-full flex-col items-center justify-center bg-gray-100 p-6 text-center">
                <p className="mb-4 text-gray-700">Failed to load camera stream</p>
                <Button onClick={retryStream}>Retry</Button>
              </div>
            ) : (
              <img
                ref={imgRef}
                key={streamKey}
                src={streamUrl}
                alt={`Stream from ${camera.name || camera.camera_id}`}
                className="h-full w-full object-contain"
                onError={handleStreamError}
              />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-200">
              <p className="text-gray-500">Camera disabled</p>
            </div>
          )}
          
          {showControls && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="annotations"
                      checked={annotated}
                      onCheckedChange={setAnnotated}
                    />
                    <Label htmlFor="annotations" className="text-white">
                      Show Annotations
                    </Label>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="bg-white/20 text-white hover:bg-white/40"
                >
                  {fullscreen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
                      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
                      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                    </svg>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
