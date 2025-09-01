/**
 * API client for camera-related endpoints
 */
import axios from 'axios';
import { CameraConfig, CameraList, LineDefinition } from '@/types';

// Verify your API_URL constant
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const camerasApi = {
  /**
   * Get all cameras
   */
  getAllCameras: async (): Promise<CameraConfig[]> => {
    try {
      const response = await axios.get<CameraList>(`${API_URL}/cameras/`);
      return response.data.cameras;
    } catch (error) {
      console.error('Error fetching cameras:', error);
      return [];
    }
  },

  /**
   * Get a camera by ID
   */
  getCamera: async (cameraId: string): Promise<CameraConfig | null> => {
    try {
      const response = await axios.get<CameraConfig>(`${API_URL}/cameras/${cameraId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching camera ${cameraId}:`, error);
      return null;
    }
  },

  /**
   * Add a new camera
   */
  addCamera: async (camera: Omit<CameraConfig, 'camera_id'>): Promise<CameraConfig | null> => {
    // Generate a unique camera ID if not provided
    const cameraToAdd: CameraConfig = {
      camera_id: `cam_${Date.now().toString(36)}`,
      ...camera,
      enabled: camera.enabled ?? true,
    };
    
    try {
      const response = await axios.post<CameraConfig>(`${API_URL}/cameras/`, cameraToAdd);
      return response.data;
    } catch (error) {
      console.error('Error adding camera:', error);
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
      console.error(`Error updating camera ${camera.camera_id}:`, error);
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
      console.error(`Error deleting camera ${cameraId}:`, error);
      return false;
    }
  },

  /**
   * Set the counting line for a camera
   */
  setCountingLine: async (lineDefinition: LineDefinition): Promise<boolean> => {
    try {
      // Change "line" to "lines" to match the backend endpoint
      const lineData = {
        camera_id: lineDefinition.camera_id,
        points: lineDefinition.points
      };

      await axios.post(`${API_URL}/cameras/${lineDefinition.camera_id}/lines`, lineData);
      return true;
    } catch (error) {
      console.error('Error setting counting line:', error);
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
    return `${API_URL}/cameras/${cameraId}/snapshot?annotated=${annotated}`;
  }
};

export default camerasApi;
