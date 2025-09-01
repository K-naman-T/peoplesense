"use client";

/**
 * Camera Detail Page
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StreamView } from '@/components/camera-view/stream-view';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CameraConfig, TrackingStats } from '@/types';
import camerasApi from '@/lib/api-client/cameras';
import statsApi from '@/lib/api-client/stats';

export default function CameraDetailPage({ params }: { params: { id: string } }) {
  const [camera, setCamera] = useState<CameraConfig | null>(null);
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch camera and stats data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const cameraData = await camerasApi.getCamera(params.id);
        if (!cameraData) {
          setError('Camera not found');
          return;
        }
        
        setCamera(cameraData);
        
        // Get stats for this camera
        const statsData = await statsApi.getCameraStats(params.id);
        setStats(statsData);
      } catch (err) {
        console.error('Error fetching camera data:', err);
        setError('Failed to load camera data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    
    // Set up interval to refresh stats
    const intervalId = setInterval(async () => {
      try {
        const statsData = await statsApi.getCameraStats(params.id);
        setStats(statsData);
      } catch (err) {
        console.error('Error refreshing stats:', err);
      }
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [params.id]);

  if (loading) {
    return <div className="flex justify-center p-8">Loading camera details...</div>;
  }

  if (error || !camera) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Camera not found'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-8">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{camera.name || `Camera ${camera.camera_id}`}</h1>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" asChild>
            <Link href={`/cameras/${camera.camera_id}/edit`}>Configure</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/cameras">Back to Cameras</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="live" className="w-full">
        <TabsList className="grid grid-cols-2 w-[200px]">
          <TabsTrigger value="live">Live View</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
            <div>
              <StreamView camera={camera} />
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Current Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">People In</p>
                      <p className="text-2xl font-bold">{stats?.people_in || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">People Out</p>
                      <p className="text-2xl font-bold">{stats?.people_out || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Currently In Frame</p>
                      <p className="text-2xl font-bold">{stats?.people_in_frame || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tracked</p>
                      <p className="text-2xl font-bold">{stats?.total_tracked || 0}</p>
                    </div>
                  </div>
                  {stats && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      Last updated: {new Date(stats.last_updated * 1000).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="stats" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historical Statistics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="aspect-[4/3] bg-muted/20 rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Hourly Traffic Chart</p>
                </div>
                <div className="aspect-[4/3] bg-muted/20 rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">Daily Comparison Chart</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                Historical statistics visualization would include interactive charts in a production implementation.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
