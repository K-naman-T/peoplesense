/**
 * API client for statistics-related endpoints
 */
import axios from 'axios';
import { TrackingStats } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const statsApi = {
  /**
   * Get statistics for all cameras
   */
  getAllStats: async (timeRange?: string): Promise<TrackingStats[]> => {
    try {
      const url = timeRange 
        ? `${API_URL}/stats/?period=${timeRange}`
        : `${API_URL}/stats/`;
      
      const response = await axios.get<TrackingStats[]>(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching all stats:', error);
      return [];
    }
  },

  /**
   * Get statistics for a specific camera
   */
  getCameraStats: async (cameraId: string): Promise<TrackingStats | null> => {
    try {
      const response = await axios.get<TrackingStats>(`${API_URL}/stats/${cameraId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching stats for camera ${cameraId}:`, error);
      return null;
    }
  },
  
  /**
   * Get historical statistics for a specific camera by time period
   */
  getCameraStatsByPeriod: async (cameraId: string, period: string): Promise<TrackingStats | null> => {
    try {
      const response = await axios.get<TrackingStats>(
        `${API_URL}/stats/${cameraId}?period=${period}`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching stats for camera ${cameraId} with period ${period}:`, error);
      return null;
    }
  },

  /**
   * Format timestamp to readable date/time
   */
  formatTimestamp: (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  }
};

export default statsApi;
