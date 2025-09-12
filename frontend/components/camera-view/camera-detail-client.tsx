'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CameraConfig, TrackingStats } from '@/types';
import statsApi from '@/lib/api-client/stats';
import { StreamView } from '@/components/camera-view/stream-view';

interface CameraDetailClientProps {
  initialCamera: CameraConfig;
  initialStats: TrackingStats;
}

export function CameraDetailClient({ initialCamera, initialStats }: CameraDetailClientProps) {
  const [camera, setCamera] = useState(initialCamera);
  const [stats, setStats] = useState(initialStats || {});
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timer | null>(null);

  // Set up polling for statistics updates
  useEffect(() => {
    // Get initial stats
    statsApi.getCameraStats(camera.camera_id).then(newStats => {
      if (newStats) setStats(newStats);
    });

    // Set up polling
    const interval = setInterval(() => {
      statsApi.getCameraStats(camera.camera_id).then(newStats => {
        if (newStats) setStats(newStats);
      });
    }, 2000); // Update every 2 seconds

    setRefreshInterval(interval);
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [camera.camera_id]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{camera.name}</h1>
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
              {/* Stream view with the camera feed */}
              <StreamView camera={camera} />
              
              {/* Line info - show information about the counting line */}
              {camera.line_points && camera.line_points.length === 2 ? (
                <Card className="mt-4">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Counting Line Configured</p>
                        <p className="text-xs text-muted-foreground">
                          Points: ({camera.line_points[0].x}%, {camera.line_points[0].y}%) to ({camera.line_points[1].x}%, {camera.line_points[1].y}%)
                        </p>
                      </div>
                      <Button variant="outline" asChild size="sm">
                        <Link href={`/cameras/${camera.camera_id}/edit`}>Edit Line</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="mt-4 border-dashed">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">No counting line configured</p>
                      <Button variant="outline" asChild size="sm">
                        <Link href={`/cameras/${camera.camera_id}/edit`}>Set Up Line</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Current Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-4">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <dt className="text-sm font-medium text-muted-foreground">People In</dt>
                      <dd className="text-3xl font-bold">{stats.people_in || 0}</dd>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <dt className="text-sm font-medium text-muted-foreground">People Out</dt>
                      <dd className="text-3xl font-bold">{stats.people_out || 0}</dd>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <dt className="text-sm font-medium text-muted-foreground">Current Count</dt>
                      <dd className="text-3xl font-bold">{stats.current_count || 0}</dd>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <dt className="text-sm font-medium text-muted-foreground">Last Updated</dt>
                      <dd className="text-sm">{stats.last_updated || 'Never'}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="stats">
          {/* Add your statistics visualizations here */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-medium mb-4">Detailed Statistics</h3>
              {/* You could add charts or more detailed statistics here */}
              <p className="text-muted-foreground">Detailed statistics coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}