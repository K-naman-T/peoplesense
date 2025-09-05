/**
 * Camera Edit/Configure Page (Server Component)
 */
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CameraEditForm } from '@/components/camera-form/camera-edit-form';
// --- START: FIX ---
// Use the SERVER-SIDE API client in this Server Component
import camerasApiServer from '@/lib/api-client/api-client-server';
// --- END: FIX ---
import { notFound } from 'next/navigation';

export default async function CameraEditPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // Fetch data on the server using the correct client
  const camera = await camerasApiServer.getCamera(id);

  if (!camera) {
    notFound();
  }

  return (
    <div className="grid gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Configure Camera</h1>
        <Button variant="outline" asChild>
          <Link href={`/cameras/${camera.camera_id}`}>Cancel</Link>
        </Button>
      </div>
      
      {/* Render the client component with the initial data as a prop */}
      <CameraEditForm initialCamera={camera} />
    </div>
  );
}
