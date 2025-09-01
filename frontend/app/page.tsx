'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CameraCard } from '@/components/camera-view/camera-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CameraConfig, TrackingStats } from '@/types';
import camerasApi from '@/lib/api-client/cameras';
import statsApi from '@/lib/api-client/stats';

export default function Home() {
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
    
    // Set up interval to refresh data
    const intervalId = setInterval(fetchData, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(intervalId);
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

  // Calculate total stats across all cameras
  const totalStats = cameras.reduce(
    (acc, camera) => {
      const stat = stats[camera.camera_id] || { people_in: 0, people_out: 0, people_in_frame: 0 };
      acc.peopleIn += stat.people_in || 0;
      acc.peopleOut += stat.people_out || 0;
      acc.peopleInFrame += stat.people_in_frame || 0;
      return acc;
    },
    { peopleIn: 0, peopleOut: 0, peopleInFrame: 0 }
  );

  return (
    <div className="grid gap-8">
      {/* Header area */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <Button asChild>
          <Link href="/cameras/add">Add Camera</Link>
        </Button>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total People In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.peopleIn}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total People Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.peopleOut}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Currently in Frame</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.peopleInFrame}</div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && cameras.length === 0 ? (
        <div className="grid place-items-center p-8">
          <p>Loading cameras...</p>
        </div>
      ) : cameras.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed p-8 text-center">
          <div>
            <h2 className="mb-2 text-lg font-semibold">No cameras configured</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Add your first camera to start tracking
            </p>
            <Button asChild>
              <Link href="/cameras/add">Add Camera</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="text-xl font-semibold">Camera Feeds</h2>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {cameras.map((camera) => (
              <CameraCard 
                key={camera.camera_id}
                camera={camera}
                stats={stats[camera.camera_id]}
                onToggleEnabled={handleToggleCamera}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
