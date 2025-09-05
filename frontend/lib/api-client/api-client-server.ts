/**
 * API client for SERVER-SIDE usage only.
 * This should be used in Server Components, API Routes, etc.
 */
import axios from 'axios';
import { CameraConfig } from '@/types';

const API_URL = process.env.INTERNAL_API_URL;

if (!API_URL) {
  throw new Error("FATAL: INTERNAL_API_URL environment variable is not set for server-side API client.");
}

const camerasApiServer = {
  /**
   * Get a camera by ID (server-side)
   */
  getCamera: async (cameraId: string): Promise<CameraConfig | null> => {
    try {
      const response = await axios.get<CameraConfig>(`${API_URL}/cameras/${cameraId}`);
      return response.data;
    } catch (error) {
      console.error(`[SERVER] Error fetching camera ${cameraId}:`, error);
      return null;
    }
  },

  /**
   * Get all cameras (server-side)
   */
  getAllCameras: async (): Promise<CameraConfig[]> => {
    try {
      const response = await axios.get<CameraConfig[]>(`${API_URL}/cameras/`);
      return response.data;
    } catch (error) {
      console.error('[SERVER] Error fetching cameras:', error);
      return [];
    }
  },
};

export default camerasApiServer;