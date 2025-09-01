'use client';

/**
 * Settings Page
 * Allows user to configure global application settings
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Model settings
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [trackingThreshold, setTrackingThreshold] = useState(0.5);
  
  // Storage settings
  const [storeFrames, setStoreFrames] = useState(false);
  const [storagePath, setStoragePath] = useState('/data/frames');
  
  // System settings
  const [enableDebug, setEnableDebug] = useState(false);
  const [maxCameras, setMaxCameras] = useState(4);
  
  // Handle settings save
  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // In a real app, we would save the settings to the API
    // Example:
    // await settingsApi.updateSettings({ 
    //   model: { confidenceThreshold, trackingThreshold },
    //   storage: { storeFrames, storagePath },
    //   system: { enableDebug, maxCameras }
    // });
    
    setSaving(false);
    setSuccess(true);
    
    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure the application settings for people tracking.
        </p>
      </div>

      <Tabs defaultValue="model">
        <TabsList className="grid grid-cols-3 w-[300px]">
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>
        
        <TabsContent value="model" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detection Model Settings</CardTitle>
              <CardDescription>
                Configure the object detection and tracking parameters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <div className="grid grid-cols-[1fr_auto] items-center">
                  <Label htmlFor="confidenceThreshold">Confidence Threshold</Label>
                  <span className="text-sm font-medium">{confidenceThreshold.toFixed(2)}</span>
                </div>
                <Slider 
                  id="confidenceThreshold"
                  min={0} 
                  max={1} 
                  step={0.01}
                  value={[confidenceThreshold]}
                  onValueChange={(value: number[]) => setConfidenceThreshold(value[0])}
                />
                <p className="text-sm text-muted-foreground">
                  Minimum confidence score for object detection.
                </p>
              </div>
              
              <div className="grid gap-2">
                <div className="grid grid-cols-[1fr_auto] items-center">
                  <Label htmlFor="trackingThreshold">Tracking Threshold</Label>
                  <span className="text-sm font-medium">{trackingThreshold.toFixed(2)}</span>
                </div>
                <Slider 
                  id="trackingThreshold"
                  min={0} 
                  max={1} 
                  step={0.01}
                  value={[trackingThreshold]}
                  onValueChange={(value: number[]) => setTrackingThreshold(value[0])}
                />
                <p className="text-sm text-muted-foreground">
                  Threshold for tracking objects between frames.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Settings</CardTitle>
              <CardDescription>
                Configure how and where data is stored.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                <Switch 
                  id="storeFrames" 
                  checked={storeFrames}
                  onCheckedChange={setStoreFrames}
                />
                <Label htmlFor="storeFrames">Store Video Frames</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, video frames with detections will be saved to disk.
              </p>
              
              <div className="grid gap-2">
                <Label htmlFor="storagePath">Storage Path</Label>
                <Input
                  id="storagePath"
                  value={storagePath}
                  onChange={(e) => setStoragePath(e.target.value)}
                  placeholder="/data/frames"
                  disabled={!storeFrames}
                />
                <p className="text-sm text-muted-foreground">
                  Path where video frames will be stored.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Configure general system parameters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                <Switch 
                  id="enableDebug" 
                  checked={enableDebug}
                  onCheckedChange={setEnableDebug}
                />
                <Label htmlFor="enableDebug">Enable Debug Mode</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Enables additional logging and debugging features.
              </p>
              
              <div className="grid gap-2">
                <Label htmlFor="maxCameras">Maximum Concurrent Cameras</Label>
                <Input
                  id="maxCameras"
                  type="number"
                  min={1}
                  max={12}
                  value={maxCameras}
                  onChange={(e) => setMaxCameras(parseInt(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  Maximum number of camera feeds that can be processed concurrently.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-[1fr_auto] items-center gap-4">
        {success && (
          <p className="text-sm text-green-500 justify-self-end">
            Settings saved successfully!
          </p>
        )}
        {!success && <div></div>}
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
