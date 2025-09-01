'use client';

/**
 * CameraCard Component
 * A card component displaying camera feed with stats
 */
import { useState } from 'react';
import Link from 'next/link';
import { StreamView } from './stream-view';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CameraConfig, TrackingStats } from '@/types';
import camerasApi from '@/lib/api-client/cameras';

interface CameraCardProps {
  camera: CameraConfig;
  stats?: TrackingStats;
  onToggleEnabled?: (cameraId: string, enabled: boolean) => Promise<void>;
}

export function CameraCard({ camera, stats, onToggleEnabled }: CameraCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (enabled: boolean) => {
    if (!onToggleEnabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await onToggleEnabled(camera.camera_id, enabled);
    } catch (err) {
      setError('Failed to toggle camera');
      console.error('Error toggling camera:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden grid grid-rows-[auto_1fr_auto]">
      <CardHeader className="p-4">
        <div className="grid grid-cols-[1fr_auto] items-center">
          <CardTitle className="text-lg">{camera.name || `Camera ${camera.camera_id}`}</CardTitle>
          <Switch 
            checked={camera.enabled} 
            onCheckedChange={handleToggle}
            disabled={loading}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="aspect-video w-full overflow-hidden bg-muted/20">
          {camera.enabled ? (
            <StreamView camera={camera} />
          ) : (
            <div className="grid place-items-center h-full w-full bg-muted">
              <p className="text-muted-foreground">Camera disabled</p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="grid gap-4 p-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="grid gap-1">
            <p className="text-muted-foreground">In</p>
            <p className="font-semibold">{stats?.people_in || 0}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-muted-foreground">Out</p>
            <p className="font-semibold">{stats?.people_out || 0}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-muted-foreground">In Frame</p>
            <p className="font-semibold">{stats?.people_in_frame || 0}</p>
          </div>
          <div className="grid gap-1">
            <p className="text-muted-foreground">Total Tracked</p>
            <p className="font-semibold">{stats?.total_tracked || 0}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" asChild>
            <Link href={`/cameras/${camera.camera_id}`}>
              View
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/cameras/${camera.camera_id}/edit`}>
              Configure
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
