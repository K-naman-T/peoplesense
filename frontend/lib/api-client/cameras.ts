/**
 * API client for BROWSER-SIDE usage only.
 */
import axios from 'axios';
import { CameraConfig } from '@/types';

// Create an axios instance with timeouts
const apiClient = axios.create({
  timeout: 5000, // 5 second timeout for all requests
  headers: {
    'Content-Type': 'application/json'
  }
});

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await apiClient.get<CameraConfig[]>(`${API_URL}/cameras/`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.data;
    } catch (error) {
      console.error('[BROWSER] Error fetching cameras:', error);
      return [];
    }
  },

  /**
   * Get camera by ID
   */
  getCamera: async (cameraId: string): Promise<CameraConfig | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await apiClient.get<CameraConfig>(`${API_URL}/cameras/${cameraId}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.data;
    } catch (error) {
      console.error(`[BROWSER] Error fetching camera ${cameraId}:`, error);
      return null;
    }
  },

  /**
   * Update a camera configuration
   */
  updateCamera: async (cameraId: string, payload: Omit<CameraConfig, 'camera_id'>): Promise<CameraConfig | null> => {
    let timeoutId: NodeJS.Timeout;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 8000); // Increased timeout
      
      const response = await apiClient.put<CameraConfig>(`${API_URL}/cameras/${cameraId}`, payload, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.data;
    } catch (error: any) {
      clearTimeout(timeoutId!);
      if (error.name === 'AbortError' || error.name === 'CanceledError' || 
          error.message?.includes('canceled')) {
        console.error(`[BROWSER] Request timed out when updating camera ${cameraId}`);
      } else {
        console.error(`[BROWSER] Error updating camera ${cameraId}:`, error);
      }
      return null;
    }
  },

  /**
   * Delete a camera
   */
  deleteCamera: async (cameraId: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await apiClient.delete(`${API_URL}/cameras/${cameraId}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
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
  },

  /**
   * Add a new camera
   */
  addCamera: async (payload: Omit<CameraConfig, 'camera_id'>): Promise<CameraConfig | null> => {
    let timeoutId: NodeJS.Timeout;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 8000); // Increased timeout
      
      const response = await apiClient.post<CameraConfig>(`${API_URL}/cameras/`, payload, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.data;
    } catch (error: any) {
      clearTimeout(timeoutId!); // Always clear the timeout
      
      // Better error handling with specific user feedback
      if (error.name === 'AbortError' || error.name === 'CanceledError' || 
          error.message?.includes('canceled')) {
        console.error('[BROWSER] Request timed out when adding camera - server took too long to respond');
        // You could throw a more specific error here if needed
      } else {
        console.error('[BROWSER] Error adding camera:', error);
      }
      return null;
    }
  },
};

export default camerasApiBrowser;
