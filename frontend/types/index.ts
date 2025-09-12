/**
 * Type definitions for the People Tracking application
 * These types mirror the backend Pydantic models
 */

// Camera configuration type
export interface CameraConfig {
  camera_id: string;
  stream_url: string;
  name?: string;
  // This is the correct type: an array of Point objects.
  line_points?: Point[];
  enabled: boolean;
}

// Tracking statistics type
export interface TrackingStats {
  camera_id: string;
  camera_name: string;
  people_in: number;
  people_out: number;
  current_count: number;
  total_tracked: number;
  last_updated: string;
}

/**
 * A 2D point with x and y coordinates, represented as percentages.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * DEPRECATED: This structure is not what the API expects for line_points.
 * We will keep it here for reference but remove it from CameraConfig.
 */
export interface LineDefinition {
  p1: Point;
  p2: Point;
}

// Camera list response
export interface CameraList {
  cameras: CameraConfig[];
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
