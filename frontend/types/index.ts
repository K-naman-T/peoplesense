/**
 * Type definitions for the People Tracking application
 * These types mirror the backend Pydantic models
 */

// Camera configuration type
export interface CameraConfig {
  camera_id: string;
  stream_url: string;
  name?: string;
  line_points?: [number, number][];
  enabled: boolean;
}

// Tracking statistics type
export interface TrackingStats {
  camera_id: string;
  camera_name: string; // This should also be in the type
  people_in: number;
  people_out: number;
  current_count: number; // FIX: Changed from people_in_frame
  total_tracked: number;
  last_updated: string; // FIX: Changed from number to match backend
}

// Line definition for counting
export interface LineDefinition {
  camera_id: string;
  points: Point[];
  id?: string; // Optional to maintain backward compatibility
}

// Camera list response
export interface CameraList {
  cameras: CameraConfig[];
}

// Point interface for the line drawing functionality
export interface Point {
  x: number;
  y: number;
}

// Line drawing state
export interface LineDrawingState {
  points: Point[];
  isDrawing: boolean;
}

// API response wrapper type
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// For stats display and charts
export interface StatsPeriod {
  start: Date;
  end: Date;
}

// Chart data point format
export interface ChartData {
  time: string;
  in: number;
  out: number;
  inFrame: number;
}
