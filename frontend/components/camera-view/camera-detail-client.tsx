'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StreamView } from '@/components/camera-view/stream-view';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CameraConfig, TrackingStats } from '@/types';
import statsApi from '@/lib/api-client/stats';

interface CameraDetailClientProps {
  initialCamera: CameraConfig;
  initialStats: TrackingStats | null;
}

export function CameraDetailClient({ initialCamera, initialStats }: CameraDetailClientProps) {
  const [camera] = useState<CameraConfig>(initialCamera);
  const [stats, setStats] = useState<TrackingStats | null>(initialStats);

  // Set up interval to refresh stats on the client
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const statsData = await statsApi.getCameraStats(camera.camera_id);
        setStats(statsData);
      } catch (err) {
        console.error('Error refreshing stats:', err);
      }
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(intervalId);
  }, [camera.camera_id]);

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
                      <p className="text-2xl font-bold">{stats?.current_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Tracked</p>
                      <p className="text-2xl font-bold">{stats?.total_tracked || 0}</p>
                    </div>
                  </div>
                  {stats && stats.last_updated && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      Last updated: {new Date(stats.last_updated).toLocaleString()}
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
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Historical statistics visualization is not yet implemented.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}