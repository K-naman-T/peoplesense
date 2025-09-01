'use client';

/**
 * Cameras List Page
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CameraCard } from '@/components/camera-view/camera-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CameraConfig, TrackingStats } from '@/types';
import camerasApi from '@/lib/api-client/cameras';
import statsApi from '@/lib/api-client/stats';

export default function CamerasPage() {
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [stats, setStats] = useState<Record<string, TrackingStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch cameras and stats
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const camerasData = await camerasApi.getAllCameras();
        setCameras(camerasData);

        // Get stats for all cameras
        const statsData = await statsApi.getAllStats();
        const statsMap: Record<string, TrackingStats> = {};
        statsData.forEach(stat => {
          statsMap[stat.camera_id] = stat;
        });
        setStats(statsMap);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load camera data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleToggleCamera = async (cameraId: string, enabled: boolean) => {
    const camera = cameras.find(c => c.camera_id === cameraId);
    if (!camera) return;
    
    const updatedCamera = { ...camera, enabled };
    const result = await camerasApi.updateCamera(updatedCamera);
    
    if (result) {
      setCameras(cameras.map(c => 
        c.camera_id === cameraId ? { ...c, enabled } : c
      ));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Camera Management</h1>
        <Button asChild>
          <Link href="/cameras/add">Add Camera</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Camera Sources</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex justify-center p-8">
              <p>Loading cameras...</p>
            </div>
          ) : cameras.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <h2 className="mb-2 text-lg font-semibold">No cameras configured</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Add your first camera to start tracking
              </p>
              <Button asChild>
                <Link href="/cameras/add">Add Camera</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {cameras.map((camera) => (
                <CameraCard 
                  key={camera.camera_id}
                  camera={camera}
                  stats={stats[camera.camera_id]}
                  onToggleEnabled={handleToggleCamera}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
