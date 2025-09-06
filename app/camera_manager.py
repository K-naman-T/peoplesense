import cv2
import time
import json
import threading  # Keep this import
import numpy as np
from uuid import uuid4
from typing import Dict, List, Tuple, Optional, Union
from ultralytics import YOLO
from queue import Queue, Empty # Import Queue

from app.models import CameraConfig, TrackingStats, Point

# --- CameraTracker Class ---
class CameraTracker:
    """Handles tracking for a single camera"""
    
    def __init__(self, camera_config: CameraConfig, model: YOLO):
        self.config = camera_config
        self.model = model
        self.is_running = False
        self.processing_thread = None
        self.reader_thread = None # Thread for reading frames
        self.frame_queue = Queue(maxsize=2) # Use a queue to hold frames
        self.lock = threading.Lock()

        # State
        self.last_frame: Optional[np.ndarray] = None
        self.annotated_frame: Optional[np.ndarray] = None
        self.stats = TrackingStats(camera_id=self.config.camera_id, camera_name=self.config.name)
        self.last_positions: Dict[str, Tuple[int, int]] = {}
        self.counted_ids: set[str] = set()

    def start(self):
        """Start the tracking and reading threads"""
        # --- FIX: Remove the 'enabled' check, only check if already running ---
        if self.is_running:
            return
        self.is_running = True
        # Start the frame reader thread
        self.reader_thread = threading.Thread(target=self._frame_reader_loop, daemon=True)
        self.reader_thread.start()
        # Start the main processing thread
        self.processing_thread = threading.Thread(target=self._tracking_loop, daemon=True)
        self.processing_thread.start()
            
    def stop(self):
        """Stop the tracking threads"""
        self.is_running = False
        # Wait for threads to finish
        if self.reader_thread:
            self.reader_thread.join(timeout=2)
        if self.processing_thread:
            self.processing_thread.join(timeout=2)

    def _frame_reader_loop(self):
        """Dedicated loop to read frames from the camera and put them in a queue."""
        cap = None
        while self.is_running:
            try:
                # --- START: ROBUST RECONNECTION LOGIC ---
                if cap is None or not cap.isOpened():
                    print(f"Attempting to connect to camera: {self.config.name}")
                    cap = cv2.VideoCapture(self.config.stream_url)
                    if not cap.isOpened():
                        print(f"Error: Could not open stream for {self.config.name}. Retrying in 5 seconds...")
                        time.sleep(5)
                        continue # Go to the start of the loop and try again

                if self.frame_queue.full():
                    time.sleep(0.01)
                    continue

                grabbed = cap.grab()
                if not grabbed:
                    print(f"Warning: No frame grabbed from {self.config.name}. Reconnecting...")
                    cap.release()
                    cap = None # Signal to reconnect on the next loop iteration
                    time.sleep(2)
                    continue
                
                ret, frame = cap.retrieve()
                if ret:
                    self.frame_queue.put(frame)
                # --- END: ROBUST RECONNECTION LOGIC ---

            except Exception as e:
                print(f"Error in frame reader for {self.config.name}: {e}")
                if cap:
                    cap.release()
                cap = None
                time.sleep(5) # Wait before trying to recover from the exception
        
        if cap:
            cap.release()
        print(f"Frame reader stopped for {self.config.name}")

    def _tracking_loop(self):
        """The main loop for video processing, now consuming from the queue."""
        print(f"Tracking loop started for {self.config.name}")
        while self.is_running:
            try:
                # Get a frame from the queue with a timeout
                frame = self.frame_queue.get(timeout=1.0)
            except Empty:
                # If queue is empty, loop again to check self.is_running
                continue
            except Exception as e:
                print(f"Error getting frame from queue for {self.config.name}: {e}")
                continue

            try:
                # --- The rest of the processing logic remains the same ---
                frame_height, frame_width, _ = frame.shape
                
                # Process the frame for object detection regardless of enabled status
                results = self.model.track(frame, persist=True, classes=[0], verbose=False)
                
                annotated_frame = frame.copy()
                current_ids = set()

                # Draw detected people
                if results[0].boxes.id is not None:
                    boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
                    ids = results[0].boxes.id.cpu().numpy().astype(int)
                    
                    for box, obj_id in zip(boxes, ids):
                        # Basic detection and drawing happens regardless of enabled status
                        x1, y1, x2, y2 = box
                        center = ((x1 + x2) // 2, (y1 + y2) // 2)
                        str_id = str(obj_id)
                        current_ids.add(str_id)
                        
                        # Only do counting logic if the camera is enabled
                        if self.config.enabled and self.config.line_points and len(self.config.line_points) >= 2:
                            p1 = (self.config.line_points[0].x * frame_width // 100, self.config.line_points[0].y * frame_height // 100)
                            p2 = (self.config.line_points[1].x * frame_width // 100, self.config.line_points[1].y * frame_height // 100)
                            
                            prev_pos = self.last_positions.get(str_id)
                            if prev_pos:
                                side_before = self._get_side(p1, p2, prev_pos)
                                side_after = self._get_side(p1, p2, center)
                                
                                if side_before is not None and side_after is not None and side_before != side_after:
                                    if side_after == 1 and str_id not in self.counted_ids:
                                        self.stats.people_in += 1
                                        self.counted_ids.add(str_id)
                                    elif side_after == -1 and str_id in self.counted_ids:
                                        self.stats.people_out += 1
                                        self.counted_ids.remove(str_id)
                            
                        self.last_positions[str_id] = center
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.putText(annotated_frame, f"ID {str_id}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                # Draw the counting line
                if self.config.line_points and len(self.config.line_points) >= 2:
                    p1 = (self.config.line_points[0].x * frame_width // 100, self.config.line_points[0].y * frame_height // 100)
                    p2 = (self.config.line_points[1].x * frame_width // 100, self.config.line_points[1].y * frame_height // 100)
                    cv2.line(annotated_frame, p1, p2, (255, 0, 0), 2)

                # Always show stats
                cv2.putText(annotated_frame, f"In: {self.stats.people_in}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                cv2.putText(annotated_frame, f"Out: {self.stats.people_out}", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                cv2.putText(annotated_frame, f"In Frame: {len(current_ids)}", (10, 110), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

                # Always update the frames (needed for snapshots)
                with self.lock:
                    self.last_frame = frame
                    self.annotated_frame = annotated_frame
                    # Only update counting stats if enabled
                    if self.config.enabled:
                        self.stats.current_count = len(current_ids)
                        self.stats.total_tracked = max(self.stats.total_tracked, len(self.last_positions))
                    self.stats.last_updated = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

                # Only update tracking state if the camera is enabled
                if self.config.enabled:
                    self.last_positions = {k: v for k, v in self.last_positions.items() if k in current_ids}
                    self.counted_ids = {k for k in self.counted_ids if k in current_ids}

            except Exception as e:
                print(f"Error in tracking loop for {self.config.name}: {e}")
                time.sleep(1) # Avoid rapid-fire error loops
    
        print(f"Tracking loop stopped for {self.config.name}")

    def _get_side(self, p1, p2, point):
        val = (p2[0] - p1[0]) * (point[1] - p1[1]) - (p2[1] - p1[1]) * (point[0] - p1[0])
        if val > 0: return 1
        if val < 0: return -1
        return 0
    
    def get_stats(self) -> TrackingStats:
        with self.lock:
            return self.stats.copy(deep=True)
        
    def get_frame(self, annotated: bool = True):
        with self.lock:
            frame_to_return = self.annotated_frame if annotated else self.last_frame
            if frame_to_return is None: return None
            ret, buffer = cv2.imencode('.jpg', frame_to_return)
            return buffer.tobytes() if ret else None
    
    def update_config(self, new_config: CameraConfig):
        with self.lock:
            should_restart = (self.config.stream_url != new_config.stream_url or
                              self.config.enabled != new_config.enabled)
            self.config = new_config
            self.stats.camera_name = new_config.name
        if should_restart:
            self.stop()
            self.start()

# --- CameraManager Class ---
class CameraManager:
    """Manages multiple camera trackers"""
    
    def __init__(self, model_path: str = 'yolov8n.pt', config_file: str = 'cameras.json'):
        self.model = YOLO(model_path)
        self.config_file = config_file
        self.trackers: Dict[str, CameraTracker] = {}
        # --- FIX: Use a Re-entrant Lock to prevent deadlocks ---
        self.lock = threading.RLock()
        self._load_config()

    def _load_config(self):
        try:
            with open(self.config_file, 'r') as f:
                configs_data = json.load(f)
            for cam_id, config_dict in configs_data.items():
                config = CameraConfig(**config_dict)
                self.add_camera(config, save_to_file=False)
        except FileNotFoundError:
            print("Config file not found. Starting with empty configuration.")
        except Exception as e:
            print(f"Error loading config: {e}")

    def save_config(self):
        with self.lock:
            configs = {cam_id: tracker.config.dict() for cam_id, tracker in self.trackers.items()}
            with open(self.config_file, 'w') as f:
                json.dump(configs, f, indent=4)

    def add_camera(self, config: CameraConfig, save_to_file: bool = True) -> CameraConfig:
        # Create the tracker instance first.
        tracker = CameraTracker(config, self.model)

        with self.lock:
            # Add the tracker to the dictionary.
            self.trackers[config.camera_id] = tracker
            if save_to_file: self.save_config()
        
        # --- START: FIX ---
        # Start the tracker's threads AFTER adding it and releasing the lock.
        tracker.start()
        # --- END: FIX ---
            
        return config
    
    def remove_camera(self, camera_id: str) -> bool:
        with self.lock:
            if camera_id in self.trackers:
                self.trackers[camera_id].stop()
                del self.trackers[camera_id]
                self.save_config()
                return True
            return False
    
    def update_camera(self, camera_id: str, camera_update: CameraConfig) -> Optional[CameraConfig]:
        with self.lock:
            if camera_id not in self.trackers:
                return None
            
            # --- START: FIX ---
            # Get the specific tracker instance
            tracker = self.trackers[camera_id]
            
            # Call the tracker's own update method to apply the new config
            tracker.update_config(camera_update)
            # --- END: FIX ---

            self.save_config()
            return tracker.config
    
    def get_camera(self, camera_id: str) -> Optional[CameraConfig]:
        with self.lock:
            if camera_id in self.trackers:
                return self.trackers[camera_id].config
            return None
    
    def get_all_cameras(self) -> List[CameraConfig]:
        with self.lock:
            return [tracker.config for tracker in self.trackers.values()]

    def get_all_stats(self) -> List[TrackingStats]:
        with self.lock:
            return [tracker.get_stats() for tracker in self.trackers.values()]

    # --- ADD THIS METHOD ---
    def get_camera_stats(self, camera_id: str) -> Optional[TrackingStats]:
        """Get tracking statistics for a specific camera."""
        with self.lock:
            if camera_id in self.trackers:
                return self.trackers[camera_id].get_stats()
            return None
    
    def get_frame(self, camera_id: str, annotated: bool = True) -> Optional[bytes]:
        if camera_id in self.trackers:
            return self.trackers[camera_id].get_frame(annotated)
        return None

    # --- ADD THIS METHOD ---
    def shutdown(self):
        """Gracefully stop all camera trackers."""
        print("Shutting down all camera trackers...")
        with self.lock:
            for tracker in self.trackers.values():
                tracker.stop()
        print("All trackers have been signaled to stop.")