/**
 * Camera Detail Page (Server Component)
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
// --- START: FIX ---
// Use the SERVER-SIDE API client in this Server Component
import camerasApiServer from '@/lib/api-client/api-client-server';
// --- END: FIX ---
import statsApi from '@/lib/api-client/stats';
import { CameraDetailClient } from '@/components/camera-view/camera-detail-client';

export default async function CameraDetailPage({ params }: { params: { id: string } }) {
  // Destructure id directly in the Server Component.
  const { id } = params;
  
  // Fetch initial data on the server
  // --- FIX: Use the server client ---
  const camera = await camerasApiServer.getCamera(id);
  
  if (!camera) {
    return (
      <div className="grid gap-8 p-4">
        <Alert variant="destructive">
          <AlertDescription>Camera not found or failed to load.</AlertDescription>
        </Alert>
        <Button variant="outline" asChild>
          <Link href="/cameras">Back to Cameras</Link>
        </Button>
      </div>
    );
  }

  const initialStats = await statsApi.getCameraStats(id);

  // Render the client component with the initial data
  return <CameraDetailClient initialCamera={camera} initialStats={initialStats} />;
}
