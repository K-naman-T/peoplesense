import cv2
import numpy as np
from ultralytics import YOLO
import threading
import time
import uuid
from typing import Dict, List, Optional, Tuple, Set


class LineCounter:
    def __init__(self, id: str, start_point: Tuple[int, int], end_point: Tuple[int, int], name: str = ""):
        self.id = id
        self.start_point = start_point
        self.end_point = end_point
        self.name = name or f"Line {id[:8]}"
        self.counted_ids = set()
        self.count_in = 0
        self.count_out = 0
        
    def is_crossing(self, current_point: Tuple[int, int], previous_point: Optional[Tuple[int, int]]) -> Optional[str]:
        """Determine if a point has crossed the line and in which direction"""
        if previous_point is None:
            return None
            
        x1, y1 = self.start_point
        x2, y2 = self.end_point
        
        # Current and previous positions
        cx, cy = current_point
        px, py = previous_point
        
        # Line equation: Ax + By + C = 0
        A = y2 - y1
        B = x1 - x2
        C = x2 * y1 - x1 * y2
        
        # Check which side the current and previous points are on
        current_side = A * cx + B * cy + C
        previous_side = A * px + B * py + C
        
        # If the signs are different, a crossing has occurred
        if current_side * previous_side < 0:
            # Determine crossing direction (simplified approach)
            # This is a simplified way to determine direction. For a real-world application,
            # you might want to use the perpendicular vector to the line.
            if current_side > 0:
                return "in"
            else:
                return "out"
        
        return None


class PeopleTracker:
    def __init__(self, model_path: str = 'yolov8n.pt'):
        """Initialize the tracker with a specified model"""
        self.model = YOLO(model_path)
        self.cameras = {}
        self.tracking_history = {}  # Track position history for each object
        self.lock = threading.RLock()  # Thread safety

    def add_camera(self, camera_id: str, source) -> bool:
        """Add a camera source to the tracker"""
        try:
            with self.lock:
                if camera_id in self.cameras:
                    return False
                    
                # Handle different source types (int, string)
                cap = cv2.VideoCapture(source)
                if not cap.isOpened():
                    return False
                    
                self.cameras[camera_id] = {
                    "source": source,
                    "cap": cap,
                    "lines": {},
                    "enabled": True,
                    "last_frame": None,
                    "last_processed_frame": None,
                    "stats": {
                        "people_in": 0,
                        "people_out": 0,
                        "current_count": 0
                    },
                    "last_positions": {},  # Last detected positions of each person
                }
                
                # Start processing thread for this camera
                threading.Thread(
                    target=self._process_camera_feed,
                    args=(camera_id,),
                    daemon=True
                ).start()
                
                return True
                
        except Exception as e:
            print(f"Error adding camera {camera_id}: {e}")
            return False

    def remove_camera(self, camera_id: str) -> bool:
        """Remove a camera from tracking"""
        with self.lock:
            if camera_id not in self.cameras:
                return False
                
            # Release the capture
            self.cameras[camera_id]["cap"].release()
            
            # Remove the camera
            del self.cameras[camera_id]
            return True

    def add_line(self, camera_id: str, line_id: str, start_point: Tuple[int, int], 
                 end_point: Tuple[int, int], name: str = "") -> bool:
        """Add a counting line to a camera"""
        with self.lock:
            if camera_id not in self.cameras:
                return False
                
            self.cameras[camera_id]["lines"][line_id] = LineCounter(
                id=line_id,
                start_point=start_point,
                end_point=end_point,
                name=name
            )
            return True

    def remove_line(self, camera_id: str, line_id: str) -> bool:
        """Remove a counting line from a camera"""
        with self.lock:
            if camera_id not in self.cameras or line_id not in self.cameras[camera_id]["lines"]:
                return False
                
            del self.cameras[camera_id]["lines"][line_id]
            return True

    def get_camera_stats(self, camera_id: str) -> Optional[Dict]:
        """Get current statistics for a camera"""
        with self.lock:
            if camera_id not in self.cameras:
                return None
                
            return self.cameras[camera_id]["stats"].copy()

    def get_latest_frame(self, camera_id: str, with_annotations: bool = True) -> Optional[np.ndarray]:
        """Get the latest frame from a camera, with or without tracking annotations"""
        with self.lock:
            if camera_id not in self.cameras:
                return None
                
            if with_annotations and self.cameras[camera_id]["last_processed_frame"] is not None:
                return self.cameras[camera_id]["last_processed_frame"].copy()
            elif self.cameras[camera_id]["last_frame"] is not None:
                return self.cameras[camera_id]["last_frame"].copy()
            
            return None

    def _process_camera_feed(self, camera_id: str):
        """Process frames from a camera feed (runs in separate thread)"""
        camera_data = self.cameras[camera_id]
        cap = camera_data["cap"]
        
        while camera_id in self.cameras and camera_data["enabled"]:
            try:
                ret, frame = cap.read()
                if not ret:
                    # Try to reconnect
                    time.sleep(1)
                    cap = cv2.VideoCapture(camera_data["source"])
                    continue

                # Store the raw frame
                with self.lock:
                    camera_data["last_frame"] = frame.copy()
                
                # Perform object detection and tracking
                results = self.model.track(frame, persist=True, classes=[0])  # Class 0 is for 'person'
                
                # Create a copy for annotations
                annotated_frame = frame.copy()
                
                # Update current count
                current_count = 0
                
                if results[0].boxes.id is not None:
                    boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
                    ids = results[0].boxes.id.cpu().numpy().astype(int)
                    
                    current_count = len(ids)
                    
                    # Process each detected person
                    for box, obj_id in zip(boxes, ids):
                        x1, y1, x2, y2 = box
                        
                        # Calculate center of the bounding box
                        center_x = (x1 + x2) // 2
                        center_y = (y1 + y2) // 2
                        current_position = (center_x, center_y)
                        
                        # Draw bounding box and ID
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                        cv2.putText(annotated_frame, f'ID: {obj_id}', 
                                   (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
                        
                        # Get previous position for this object
                        str_id = str(obj_id)
                        previous_position = camera_data["last_positions"].get(str_id)
                        
                        # Update the position history
                        camera_data["last_positions"][str_id] = current_position
                        
                        # Check line crossings for this object
                        for line_id, line_counter in camera_data["lines"].items():
                            # Draw the counting line
                            cv2.line(annotated_frame, line_counter.start_point, line_counter.end_point, (0, 255, 0), 2)
                            
                            # Check if this object crossed the line
                            if previous_position:
                                crossing = line_counter.is_crossing(current_position, previous_position)
                                
                                if crossing == "in" and str_id not in line_counter.counted_ids:
                                    line_counter.count_in += 1
                                    line_counter.counted_ids.add(str_id)
                                    camera_data["stats"]["people_in"] += 1
                                    
                                elif crossing == "out" and str_id in line_counter.counted_ids:
                                    line_counter.count_out += 1
                                    line_counter.counted_ids.remove(str_id)
                                    camera_data["stats"]["people_out"] += 1
                
                # Update current count in stats
                camera_data["stats"]["current_count"] = current_count
                
                # Display stats on frame
                for i, (line_id, line) in enumerate(camera_data["lines"].items()):
                    y_pos = 30 + (i * 60)
                    cv2.putText(annotated_frame, f'{line.name}:', 
                               (10, y_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    cv2.putText(annotated_frame, f'In: {line.count_in} | Out: {line.count_out}', 
                               (10, y_pos + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                
                # Store the processed frame
                with self.lock:
                    camera_data["last_processed_frame"] = annotated_frame.copy()
                    
            except Exception as e:
                print(f"Error processing camera {camera_id}: {e}")
                time.sleep(1)  # Prevent tight loop on errors