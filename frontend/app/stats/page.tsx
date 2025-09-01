'use client';

/**
 * Stats Page
 * Shows analytics and statistics for people tracking data
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CameraConfig, TrackingStats } from '@/types';
import camerasApi from '@/lib/api-client/cameras';
import statsApi from '@/lib/api-client/stats';

// Placeholder for chart components (would use recharts in a real implementation)
const PlaceholderChart = ({ title }: { title: string }) => (
  <div className="flex h-[300px] w-full flex-col items-center justify-center rounded-md border border-dashed">
    <div className="text-2xl font-semibold">{title}</div>
    <div className="text-sm text-muted-foreground mt-2">Chart visualization would be displayed here</div>
  </div>
);

export default function StatsPage() {
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('today');
  const [stats, setStats] = useState<TrackingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch cameras on mount
  useEffect(() => {
    async function fetchCameras() {
      try {
        const camerasData = await camerasApi.getAllCameras();
        setCameras(camerasData);
        
        // Select the first camera by default if available
        if (camerasData.length > 0) {
          setSelectedCamera(camerasData[0].camera_id);
        }
      } catch (err) {
        console.error('Error fetching cameras:', err);
        setError('Failed to load cameras');
      }
    }

    fetchCameras();
  }, []);

  // Fetch stats when selected camera or time range changes
  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      setError(null);
      
      try {
        let statsData;
        if (selectedCamera === 'all') {
          statsData = await statsApi.getAllStats(timeRange);
        } else {
          statsData = await statsApi.getCameraStatsByPeriod(selectedCamera, timeRange);
        }
        
        setStats(Array.isArray(statsData) 
          ? statsData.filter((s): s is TrackingStats => s !== null) 
          : statsData ? [statsData] : []);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError('Failed to load statistics data');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [selectedCamera, timeRange]);

  // Calculate totals
  const totals = stats.reduce(
    (acc, stat) => ({
      peopleIn: acc.peopleIn + (stat?.people_in || 0),
      peopleOut: acc.peopleOut + (stat?.people_out || 0),
      totalTracked: acc.totalTracked + (stat?.total_tracked || 0),
    }),
    { peopleIn: 0, peopleOut: 0, totalTracked: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            View and analyze people tracking statistics.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Camera" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cameras</SelectItem>
              {cameras.map((camera) => (
                <SelectItem key={camera.camera_id} value={camera.camera_id}>
                  {camera.name || `Camera ${camera.camera_id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">People In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.peopleIn}</div>
            <p className="text-xs text-muted-foreground">
              Total people counted entering
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">People Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.peopleOut}</div>
            <p className="text-xs text-muted-foreground">
              Total people counted exiting
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tracked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.totalTracked}</div>
            <p className="text-xs text-muted-foreground">
              Total people tracked in all cameras
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="w-full">
        <TabsList>
          <TabsTrigger value="trends">Traffic Trends</TabsTrigger>
          <TabsTrigger value="hourly">Hourly Distribution</TabsTrigger>
          <TabsTrigger value="comparison">Camera Comparison</TabsTrigger>
        </TabsList>
        
        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>People Traffic Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <PlaceholderChart title="Traffic Trend Chart" />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="hourly" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Traffic Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <PlaceholderChart title="Hourly Distribution Chart" />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="comparison" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Camera Traffic Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <PlaceholderChart title="Camera Comparison Chart" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {loading && (
        <div className="flex justify-center p-8">
          <p>Loading statistics data...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
