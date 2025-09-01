'use client';

/**
 * Add Camera Page
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import camerasApi from '@/lib/api-client/cameras';

// Utility function to validate URL
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};

// Check if it's a valid stream source (URL or number for local device)
const isValidStreamSource = (source: string) => {
  return isValidUrl(source) || /^\d+$/.test(source);
};

export default function AddCameraPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    stream_url: '',
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggle = (enabled: boolean) => {
    setFormData((prev) => ({ ...prev, enabled }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.stream_url) {
      setError('Stream URL is required');
      return;
    }

    if (!isValidStreamSource(formData.stream_url)) {
      setError('Please enter a valid stream URL or device number (e.g., 0 for webcam)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newCamera = await camerasApi.addCamera({
        name: formData.name || `Camera ${Date.now().toString(36)}`,
        stream_url: formData.stream_url,
        enabled: formData.enabled,
      });

      if (newCamera) {
        // Redirect to the line configuration page for the new camera
        router.push(`/cameras/${newCamera.camera_id}/edit`);
      } else {
        setError('Failed to add camera. Please try again.');
      }
    } catch (err) {
      console.error('Error adding camera:', err);
      setError('Failed to add camera. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Add Camera</h1>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Camera Details</CardTitle>
            <CardDescription>
              Add a new camera to the tracking system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Camera Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Living Room Camera"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stream_url">Stream URL</Label>
              <Input
                id="stream_url"
                name="stream_url"
                placeholder="rtsp://username:password@192.168.1.100:554/stream"
                value={formData.stream_url}
                onChange={handleChange}
                required
              />
              <p className="text-xs text-muted-foreground">
                Enter RTSP, HTTP, or local device URL (e.g., 0 for webcam)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={handleToggle}
              />
              <Label htmlFor="enabled">Enable camera tracking immediately</Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Camera'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
