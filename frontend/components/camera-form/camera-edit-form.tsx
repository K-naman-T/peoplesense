'use client';

import { useState } from 'react';
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
import { LineConfigurator } from '@/components/camera-view/line-configurator';

interface CameraEditFormProps {
  initialCamera: CameraConfig;
}

export function CameraEditForm({ initialCamera }: CameraEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState<string>(initialCamera.name || '');
  const [streamUrl, setStreamUrl] = useState<string>(initialCamera.stream_url || '');
  const [enabled, setEnabled] = useState<boolean>(initialCamera.enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The initial data is now in the correct Point[] format. No conversion needed.
  const [linePoints, setLinePoints] = useState<Point[]>(initialCamera.line_points || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    try {
      // The `linePoints` state is already in the correct format [{x, y}, {x, y}].
      const updatePayload = {
        name,
        stream_url: streamUrl,
        enabled,
        line_points: linePoints,
      };
      
      await camerasApi.updateCamera(initialCamera.camera_id, updatePayload);
      
      router.push(`/cameras/${initialCamera.camera_id}`);
      router.refresh();
    } catch (err) {
      console.error('Error saving camera:', err);
      setError('Failed to save camera configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-8">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6">
            <div className="grid gap-3">
              <Label htmlFor="name">Camera Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter a name for this camera" />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="streamUrl">Camera Stream URL</Label>
              <Input id="streamUrl" value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="rtsp:// or http:// URL for the camera feed" required />
            </div>
            <div className="grid grid-cols-[auto_1fr] items-center gap-2">
              <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
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
          </p>
        </div>
        <div className="relative h-[480px] w-full bg-muted">
          <LineConfigurator 
            cameraId={initialCamera.camera_id}
            initialPoints={linePoints}
            onLineChange={setLinePoints}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={`/cameras/${initialCamera.camera_id}`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}