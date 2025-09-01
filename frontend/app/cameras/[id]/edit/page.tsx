'use client';

/**
 * Camera Edit/Configure Page
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CameraConfig, Point } from '@/types';
import camerasApi from '@/lib/api-client/cameras';
import { env } from 'process';
import { LineConfigurator } from '@/components/camera-view/line-configurator';

// Define API_URL from environment or set a default value
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function CameraEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [camera, setCamera] = useState<CameraConfig | null>(null);
  const [name, setName] = useState<string>('');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linePoints, setLinePoints] = useState<Point[]>([]);

  // Fetch camera data
  useEffect(() => {
    async function fetchCamera() {
      setLoading(true);
      try {
        const cameraData = await camerasApi.getCamera(params.id);
        if (!cameraData) {
          setError('Camera not found');
          return;
        }
        
        setCamera(cameraData);
        setName(cameraData.name || '');
        setStreamUrl(cameraData.stream_url || '');
        setEnabled(cameraData.enabled);
        
        if (cameraData.line_points && cameraData.line_points.length === 2) {
          // Convert line points array to Point objects
          const points: Point[] = cameraData.line_points.map(([x, y]) => ({ x, y }));
          setLinePoints(points);
        }
      } catch (err) {
        console.error('Error fetching camera:', err);
        setError('Failed to load camera data');
      } finally {
        setLoading(false);
      }
    }

    fetchCamera();
  }, [params.id]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!camera) return;
    
    setSaving(true);
    try {
      // Convert Point objects back to [number, number][] format
      const formattedLinePoints: [number, number][] = linePoints.map(point => [point.x, point.y]);
      
      const updatedCamera: CameraConfig = {
        ...camera,
        name,
        stream_url: streamUrl,
        enabled,
        line_points: formattedLinePoints,
      };
      
      await camerasApi.updateCamera(updatedCamera);
      router.push(`/cameras/${camera.camera_id}`);
      router.refresh();
    } catch (err) {
      console.error('Error saving camera:', err);
      setError('Failed to save camera configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading camera configuration...</div>;
  }

  if (error || !camera) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Camera not found'}</AlertDescription>
      </Alert>
    );
  }

  // Add console logging to debug the URL
  console.log("Using API URL:", API_URL);
  console.log("Snapshot URL:", `${API_URL}/cameras/${camera.camera_id}/snapshot?annotated=true`);

  // Add timestamp to prevent caching of the snapshot
  const snapshotUrl = `${API_URL}/cameras/${camera.camera_id}/snapshot?annotated=true&t=${Date.now()}`;

  return (
    <div className="grid gap-8">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Configure Camera</h1>
        <Button variant="outline" asChild>
          <Link href={`/cameras/${camera.camera_id}`}>Cancel</Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-8">
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-6">
              <div className="grid gap-3">
                <Label htmlFor="name">Camera Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter a name for this camera"
                />
              </div>
              
              <div className="grid gap-3">
                <Label htmlFor="streamUrl">Camera Stream URL</Label>
                <Input
                  id="streamUrl"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="rtsp:// or http:// URL for the camera feed"
                  required
                />
              </div>
              
              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                <Switch 
                  id="enabled" 
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
                <Label htmlFor="enabled">Enabled</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <h2 className="text-xl font-bold">Counting Line Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Draw a line on the camera view to define where people will be counted as they cross it.
              Click in two different positions to create the line.
            </p>
          </div>
          
          <div className="relative h-[480px] w-full bg-muted">
            <LineConfigurator 
              cameraId={camera.camera_id}
              streamUrl={snapshotUrl}
              initialPoints={linePoints}
              onLineChange={(points: Point[]) => setLinePoints(points)}
            />
          </div>

          <p className="text-sm text-muted-foreground mt-2">
            Click two points on the image to create a counting line. The line will be saved automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto]">
          <div></div>
          <Button 
            type="submit" 
            disabled={saving}
            onClick={(e) => {
              e.stopPropagation(); // Add this to prevent the click from being captured by parent elements
            }}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </form>
    </div>
  );
}
