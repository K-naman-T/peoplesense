import cv2
import time
import threading
import numpy as np
from typing import Dict, List, Tuple, Optional
import asyncio
from ultralytics import YOLO

from app.models import CameraConfig, TrackingStats, LineDefinition
from app.tracker import PeopleTracker


class CameraTracker:
    """Handles tracking for a single camera"""
    
    def __init__(self, camera_config: CameraConfig, model_path: str = 'yolov8l.pt'):
        self.config = camera_config
        self.camera_id = camera_config.camera_id
        self.stream_url = camera_config.stream_url
        self.line_points = camera_config.line_points or [(0, 0), (0, 0)]
        self.enabled = camera_config.enabled
        
        # Initialize model
        self.model = YOLO(model_path)
        
        # Tracking data
        self.track_history = {}
        self.people_in = 0
        self.people_out = 0
        
        # Stream handling
        self.cap = None
        self.is_running = False
        self.thread = None
        self.last_frame = None
        self.annotated_frame = None
        self.last_updated = 0
        self.frame_lock = threading.Lock()
        self.current_frame = None
        
    def start(self):
        """Start the camera tracker thread"""
        if self.is_running:
            return
            
        self.cap = cv2.VideoCapture(self.stream_url)
        if not self.cap.isOpened():
            raise ValueError(f"Could not open camera stream: {self.stream_url}")
            
        self.is_running = True
        self.thread = threading.Thread(target=self._tracking_loop)
        self.thread.daemon = True
        self.thread.start()
        
    def stop(self):
        """Stop the camera tracker"""
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=5.0)
        if self.cap:
            self.cap.release()
            
    def _tracking_loop(self):
        """Main tracking loop running in a separate thread"""
        while self.is_running:
            success, frame = self.cap.read()
            
            if not success:
                # Try to reconnect
                time.sleep(1)
                self.cap.release()
                self.cap = cv2.VideoCapture(self.stream_url)
                continue
                
            self.last_frame = frame
            
            # Process frame with YOLO
            results = self.model.track(frame, persist=True, classes=0)  # Track people only
            
            # Get the boxes and track IDs
            try:
                boxes = results[0].boxes.xywh.cpu()
                track_ids = results[0].boxes.id.int().cpu().tolist()
            except (AttributeError, IndexError):
                boxes = []
                track_ids = []
                
            people_in_frame = len(track_ids)
            
            # Create annotated frame
            annotated_frame = results[0].plot()
            
            # Draw the counting line if defined
            if self.line_points and self.line_points[0] != (0, 0):
                cv2.line(annotated_frame, self.line_points[0], self.line_points[1], (0, 255, 0), 2)
                
            # Track objects and count crossings
            for box, track_id in zip(boxes, track_ids):
                x, y, w, h = box
                center_x = int(x)
                center_y = int(y)
                
                # Store previous position
                if track_id in self.track_history:
                    prev_center = self.track_history[track_id][-1]
                    
                    # Check for line crossing if line is defined
                    if self.line_points and self.line_points[0] != (0, 0):
                        prev_side = self._get_side(self.line_points[0], self.line_points[1], prev_center)
                        current_side = self._get_side(self.line_points[0], self.line_points[1], (center_x, center_y))
                        
                        if prev_side * current_side < 0:  # Line crossed
                            if current_side > 0:
                                self.people_in += 1
                            else:
                                self.people_out += 1
                                
                # Update track history
                if track_id not in self.track_history:
                    self.track_history[track_id] = []
                self.track_history[track_id].append((center_x, center_y))
                
                # Limit history length to prevent memory issues
                if len(self.track_history[track_id]) > 30:
                    self.track_history[track_id] = self.track_history[track_id][-30:]
                    
            # Add count text
            cv2.putText(annotated_frame, f"In: {self.people_in}", (50, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
            cv2.putText(annotated_frame, f"Out: {self.people_out}", (50, 80), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
            cv2.putText(annotated_frame, f"In Frame: {people_in_frame}", (50, 120), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            cv2.putText(annotated_frame, f"Total Tracked: {len(self.track_history)}", (50, 150), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                        
            with self.frame_lock:
                self.current_frame = annotated_frame.copy()
                
            self.annotated_frame = annotated_frame
            self.last_updated = time.time()
    
    def _get_side(self, p1, p2, point):
        """Determine which side of a line a point is on"""
        x1, y1 = p1
        x2, y2 = p2
        x, y = point
        return (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    
    def get_stats(self) -> TrackingStats:
        """Get current tracking statistics"""
        people_in_frame = 0
        if self.last_frame is not None and self.is_running:
            # Count from the last processed frame
            people_in_frame = sum(1 for history in self.track_history.values() 
                               if len(history) > 0 and time.time() - self.last_updated < 2.0)
                               
        return TrackingStats(
            camera_id=self.camera_id,
            people_in=self.people_in,
            people_out=self.people_out,
            people_in_frame=people_in_frame,
            total_tracked=len(self.track_history),
            last_updated=self.last_updated
        )
        
    def get_frame(self, annotated: bool = True):
        """Get the latest frame (annotated or raw)"""
        if annotated and self.annotated_frame is not None:
            return self.annotated_frame
        return self.last_frame
    
    def get_snapshot(self, annotated=True):
        """Get a single frame from the camera"""
        if not self.is_running:
            return None
            
        # Make a copy of the current frame
        with self.frame_lock:
            if self.current_frame is None:
                return None
            frame = self.current_frame.copy()
        
        # Add annotations if requested
        if annotated:
            frame = self.annotate_frame(frame)
            
        return frame
        
    def set_line(self, points):
        """Set the counting line points"""
        try:
            # Convert Point objects to tuples if needed
            if hasattr(points[0], 'x') and hasattr(points[0], 'y'):
                # Points are objects with x,y properties
                line_points = [(p.x, p.y) for p in points]
            else:
                # Points are already in the correct format
                line_points = points
                
            # Set the line in the tracker
            if len(line_points) >= 2:
                start_point = line_points[0]
                end_point = line_points[1]
                
                # Use existing line ID or create a new one
                line_id = "line_1"  # Default ID
                
                # Add or update the line
                if hasattr(self, 'tracker') and self.tracker:
                    self.tracker.add_line(
                        self.camera_id,
                        line_id,
                        start_point,
                        end_point,
                        "Counting Line"
                    )
            return True
        except Exception as e:
            print(f"Error setting line: {str(e)}")
            return False
    
    def get_current_frame(self, annotated=True):
        """Get the current frame from the camera"""
        if not self.is_running or self.current_frame is None:
            return None
            
        # Make a copy to avoid modifying the original
        with self.frame_lock:  # Assuming you use a lock for thread safety
            frame = self.current_frame.copy()
        
        # Add annotations if requested
        if annotated and frame is not None:
            frame = self.annotate_frame(frame)
            
        return frame


class CameraManager:
    """Manages multiple camera trackers"""
    
    def __init__(self, model_path: str = 'yolov8l.pt'):
        self.tracker = PeopleTracker(model_path=model_path)
        self.cameras: Dict[str, CameraConfig] = {}
        self.lock = threading.RLock()
    
    def add_camera(self, config: CameraConfig) -> str:
        """Add a new camera to the system"""
        with self.lock:
            # Use either id or camera_id
            camera_id = config.id or config.camera_id
            
            # Use either url or stream_url
            url = config.url or config.stream_url
            
            # Add to tracker
            success = self.tracker.add_camera(camera_id, url)
            
            if not success:
                raise ValueError(f"Failed to connect to camera source: {url}")
            
            # Add camera config to our store
            self.cameras[camera_id] = config
            
            # Add any defined lines to the tracker
            for line in config.lines:
                if line.start_point and line.end_point:
                    start = (line.start_point.x, line.start_point.y)
                    end = (line.end_point.x, line.end_point.y)
                    self.tracker.add_line(
                        camera_id, 
                        line.id, 
                        start, 
                        end, 
                        line.name
                    )
        
        return camera_id
    
    def remove_camera(self, camera_id: str) -> bool:
        """Remove a camera from the system"""
        with self.lock:
            if camera_id not in self.cameras:
                return False
            
            # Remove from tracker
            success = self.tracker.remove_camera(camera_id)
            
            # Remove from our store
            if success:
                del self.cameras[camera_id]
            
            return success
    
    def update_camera(self, camera_id: str, config: CameraConfig) -> bool:
        """Update camera configuration"""
        with self.lock:
            if camera_id not in self.cameras:
                return False
            
            # Check if URL has changed
            if self.cameras[camera_id].url != config.url:
                # Remove and re-add camera with new URL
                self.remove_camera(camera_id)
                config.id = camera_id  # Ensure we use the same ID
                self.add_camera(config)
            else:
                # Update our store
                self.cameras[camera_id] = config
                
                # Update enabled status
                if self.cameras[camera_id].enabled != config.enabled:
                    # Note: this would require additional handling in the tracker
                    pass
            
            return True
    
    def get_camera(self, camera_id: str) -> Optional[CameraConfig]:
        """Get camera configuration by ID"""
        with self.lock:
            return self.cameras.get(camera_id)
    
    def get_all_cameras(self) -> List[CameraConfig]:
        """Get all camera configurations"""
        with self.lock:
            return list(self.cameras.values())
    
    def get_camera_stats(self, camera_id: str) -> Optional[TrackingStats]:
        """Get tracking statistics for a camera"""
        if camera_id not in self.cameras:
            return None
        
        stats = self.tracker.get_camera_stats(camera_id)
        if not stats:
            return None
        
        # Build line stats
        line_stats = {}
        camera_data = self.tracker.cameras.get(camera_id)
        if camera_data:
            for line_id, line_counter in camera_data["lines"].items():
                line_stats[line_id] = {
                    "in": line_counter.count_in,
                    "out": line_counter.count_out
                }
        
        return TrackingStats(
            camera_id=camera_id,
            people_in=stats["people_in"],
            people_out=stats["people_out"],
            current_count=stats["current_count"],
            lines=line_stats
        )
    
    def add_line(self, camera_id: str, line: LineDefinition) -> bool:
        """Add a counting line to a camera"""
        try:
            # Get the camera config
            camera_config = self.get_camera(camera_id)
            if not camera_config:
                return False
            
            # Get points from the line definition
            if len(line.points) < 2:
                print("Error: Line needs at least 2 points")
                return False
                
            # Convert Point objects to tuples for the tracker
            start_point = (line.points[0].x, line.points[0].y)
            end_point = (line.points[1].x, line.points[1].y)
            
            # Add line to the tracker system
            line_id = "line_1"  # Default ID if needed
            success = self.tracker.add_line(
                camera_id, 
                line_id,
                start_point,
                end_point, 
                "Counting Line"
            )
            
            # Update the camera configuration with the new line
            if success:
                # Create a new line definition to add to the camera config
                new_line = LineDefinition(
                    camera_id=camera_id,
                    points=line.points
                )
                
                with self.lock:
                    # Update the camera configuration by modifying the "lines" list
                    # instead of trying to set "line_points"
                    camera = self.get_camera(camera_id)
                    if camera:
                        # Check if we need to create a new list or update existing
                        if hasattr(camera, "lines"):
                            # Update existing lines list with our new line
                            updated_lines = [l for l in camera.lines if l.id != line_id]
                            updated_lines.append(new_line)
                            camera.lines = updated_lines
                        else:
                            # Create new lines list if it doesn't exist
                            camera.lines = [new_line]
                        
                        # Also update the camera's model
                        updated_config = camera.model_copy(deep=True)
                        self.cameras[camera_id] = updated_config
                        
                        return True
            
            return False
        except Exception as e:
            print(f"Error in add_line: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def remove_line(self, camera_id: str, line_id: str) -> bool:
        """Remove a counting line from a camera"""
        with self.lock:
            if camera_id not in self.cameras:
                return False
            
            # Remove from tracker
            success = self.tracker.remove_line(camera_id, line_id)
            
            # Remove from configuration
            if success:
                self.cameras[camera_id].lines = [
                    line for line in self.cameras[camera_id].lines 
                    if line.id != line_id
                ]
            
            return success
    
    def get_frame(self, camera_id: str, annotated: bool = True) -> Optional[bytes]:
        """Get the latest frame from a camera"""
        frame = self.tracker.get_latest_frame(camera_id, with_annotations=annotated)
        
        if frame is None:
            return None
        
        # Encode as JPEG
        success, buffer = cv2.imencode(".jpg", frame)
        if not success:
            return None
        
        return buffer.tobytes()