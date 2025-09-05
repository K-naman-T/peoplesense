/**
 * API client for BROWSER-SIDE usage only.
 * This should be used in Client Components ('use client').
 */
import axios from 'axios';
import { CameraConfig, LineDefinition } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("FATAL: NEXT_PUBLIC_API_URL environment variable is not set for browser-side API client.");
}

const camerasApiBrowser = {
  /**
   * Get all cameras
   */
  getAllCameras: async (): Promise<CameraConfig[]> => {
    try {
      const response = await axios.get<CameraConfig[]>(`${API_URL}/cameras/`);
      return response.data;
    } catch (error) {
      console.error('[BROWSER] Error fetching cameras:', error);
      return [];
    }
  },

  /**
   * Add a new camera
   */
  addCamera: async (camera: Omit<CameraConfig, 'camera_id' | 'line_points'>): Promise<CameraConfig | null> => {
    try {
      const response = await axios.post<CameraConfig>(`${API_URL}/cameras/`, camera);
      return response.data;
    } catch (error) {
      console.error('[BROWSER] Error adding camera:', error);
      return null;
    }
  },

  /**
   * Update a camera configuration
   */
  updateCamera: async (camera: CameraConfig): Promise<CameraConfig | null> => {
    try {
      const response = await axios.put<CameraConfig>(`${API_URL}/cameras/${camera.camera_id}`, camera);
      return response.data;
    } catch (error) {
      console.error(`[BROWSER] Error updating camera ${camera.camera_id}:`, error);
      return null;
    }
  },

  /**
   * Delete a camera
   */
  deleteCamera: async (cameraId: string): Promise<boolean> => {
    try {
      await axios.delete(`${API_URL}/cameras/${cameraId}`);
      return true;
    } catch (error) {
      console.error(`[BROWSER] Error deleting camera ${cameraId}:`, error);
      return false;
    }
  },

  /**
   * Get the stream URL for a camera
   */
  getStreamUrl: (cameraId: string, annotated: boolean = true): string => {
    return `${API_URL}/cameras/${cameraId}/stream?annotated=${annotated}`;
  },

  /**
   * Get the snapshot URL for a camera
   */
  getSnapshotUrl: (cameraId: string, annotated: boolean = true): string => {
    return `${API_URL}/cameras/${cameraId}/snapshot?annotated=${annotated}&t=${new Date().getTime()}`;
  }
};

export default camerasApiBrowser;
