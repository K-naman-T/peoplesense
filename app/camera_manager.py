import cv2
import time
import json
import threading
import numpy as np
from uuid import uuid4
from typing import Dict, List, Tuple, Optional, Union
from ultralytics import YOLO
from queue import Queue, Empty

from app.models import CameraConfig, TrackingStats, Point

# --- CameraTracker Class ---
class CameraTracker:
    """Handles tracking for a single camera"""
    
    def __init__(self, camera_config: CameraConfig, model: YOLO):
        self.config = camera_config
        self.model = model
        self.device = model.device  # Get the device from the model
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
        # Only check if already running
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
                # Skip processing if camera is disabled - ADD THIS CHECK
                if not self.config.enabled:
                    # Release capture if camera is disabled
                    if cap and cap.isOpened():
                        cap.release()
                        cap = None
                    time.sleep(1)  # Sleep to avoid CPU spinning
                    continue
                
                # Robust reconnection logic
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
        """The main loop for video processing, consuming from the queue."""
        print(f"Tracking loop started for {self.config.name} on {self.device}")
        
        # Initialize tracking structures
        self.last_positions = {}
        self.counted_ids = set()
        
        while self.is_running:
            try:
                # Skip processing if camera is disabled - ADD THIS CHECK
                if not self.config.enabled:
                    time.sleep(0.5)  # Sleep to avoid CPU spinning
                    continue
                
                # Get a frame from the queue with a timeout
                frame = self.frame_queue.get(timeout=1.0)
                
                # Process the frame with YOLO
                results = self.model.track(frame, persist=True, classes=[0], verbose=False)
                
                # Create a copy for annotation
                annotated_frame = frame.copy()
                frame_height, frame_width, _ = frame.shape
                
                # Initialize current_ids OUTSIDE the conditional blocks
                current_ids = set()
                
                # Draw line REGARDLESS of person detection
                if self.config.line_points and len(self.config.line_points) >= 2:
                    # Add defensive unpacking to handle both formats
                    try:
                        # Extract points based on the actual data structure
                        point1 = self.config.line_points[0]
                        point2 = self.config.line_points[1]
                        
                        # Handle dict/object format from frontend
                        if isinstance(point1, dict) and 'x' in point1 and 'y' in point1:
                            x1, y1 = float(point1['x']), float(point1['y'])
                            x2, y2 = float(point2['x']), float(point2['y'])
                        elif hasattr(point1, 'x') and hasattr(point1, 'y'):
                            # Handle Pydantic model objects
                            x1, y1 = float(point1.x), float(point1.y)
                            x2, y2 = float(point2.x), float(point2.y)
                        else:
                            # Try tuple unpacking as a fallback
                            try:
                                x1, y1 = point1
                                x2, y2 = point2
                            except (TypeError, ValueError):
                                print(f"Warning: Unsupported line_points format: {self.config.line_points}")
                                continue
                            
                        # Now convert coordinates safely with extracted numeric values
                        p1 = (int(x1 * frame_width / 100), int(y1 * frame_height / 100))
                        p2 = (int(x2 * frame_width / 100), int(y2 * frame_height / 100))
                        
                        # Continue with the rest of the line drawing and crossing detection
                        cv2.line(annotated_frame, p1, p2, (0, 0, 255), 2)
                        
                    except Exception as e:
                        print(f"Error processing line points: {e}")
                        import traceback
                        traceback.print_exc()
                        continue

                # Process people detection
                if results[0].boxes.id is not None:
                    boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
                    ids = results[0].boxes.id.cpu().numpy().astype(int)
                    
                    # Process each detected person
                    for box, obj_id in zip(boxes, ids):
                        x1_box, y1_box, x2_box, y2_box = box
                        center = ((x1_box + x2_box) // 2, (y1_box + y2_box) // 2)
                        str_id = str(obj_id)
                        current_ids.add(str_id)
                        
                        # Draw bounding box
                        cv2.rectangle(annotated_frame, (x1_box, y1_box), (x2_box, y2_box), (0, 255, 0), 2)
                        cv2.putText(annotated_frame, f"ID: {str_id}", (x1_box, y1_box - 10), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                        
                        # Check for line crossing if we have previous position AND a line is defined
                        if self.config.line_points and len(self.config.line_points) >= 2:
                            # Reuse the same point extraction logic from above
                            point1 = self.config.line_points[0]
                            point2 = self.config.line_points[1]
                            
                            # Handle all possible formats of point data
                            if isinstance(point1, dict) and 'x' in point1 and 'y' in point1:
                                x1, y1 = float(point1['x']), float(point1['y'])
                                x2, y2 = float(point2['x']), float(point2['y'])
                            elif hasattr(point1, 'x') and hasattr(point1, 'y'):
                                # Handle Point objects
                                x1, y1 = float(point1.x), float(point1.y)
                                x2, y2 = float(point2.x), float(point2.y)
                            else:
                                # Try tuple unpacking as a fallback
                                try:
                                    x1, y1 = point1
                                    x2, y2 = point2
                                except (TypeError, ValueError):
                                    # Skip this iteration if points have invalid format
                                    continue
                            
                            # Convert to pixel coordinates
                            p1 = (int(x1 * frame_width / 100), int(y1 * frame_height / 100))
                            p2 = (int(x2 * frame_width / 100), int(y2 * frame_height / 100))
                            
                            prev_pos = self.last_positions.get(str_id)
                            if prev_pos:  # Remove the str_id not in self.counted_ids condition
                                # Determine which side of the line the points are on
                                side_before = self._get_side(p1, p2, prev_pos)
                                side_after = self._get_side(p1, p2, center)
                                
                                # Only count valid crossings (not just touches)
                                if side_before != 0 and side_after != 0 and side_before != side_after:
                                    # Track which direction this ID has crossed before
                                    direction_key = f"{str_id}_direction"
                                    current_direction = None
                                    
                                    # Make crossing highly visible with thicker arrows
                                    if side_before < 0 and side_after > 0:
                                        current_direction = "in"
                                        # Only count if this ID hasn't entered before or last exited
                                        last_direction = getattr(self, direction_key, None)
                                        if last_direction != "in":
                                            cv2.arrowedLine(annotated_frame, prev_pos, center, (0, 255, 0), 4)
                                            with self.lock:
                                                self.stats.people_in += 1
                                            print(f"Person {str_id} entered at position {center}")
                                            
                                    elif side_before > 0 and side_after < 0:
                                        current_direction = "out"
                                        # Only count if this ID hasn't exited before or last entered
                                        last_direction = getattr(self, direction_key, None)
                                        if last_direction != "out":
                                            cv2.arrowedLine(annotated_frame, prev_pos, center, (0, 0, 255), 4)
                                            with self.lock:
                                                self.stats.people_out += 1
                                            print(f"Person {str_id} exited at position {center}")
                                    
                                    # Remember last crossing direction for this ID
                                    if current_direction:
                                        setattr(self, direction_key, current_direction)
                        
                        # Update position for next frame
                        self.last_positions[str_id] = center
                
                # Add stats overlay to frame
                cv2.putText(annotated_frame, f"In: {self.stats.people_in}", (10, 30), 
                          cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                cv2.putText(annotated_frame, f"Out: {self.stats.people_out}", (10, 70), 
                          cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                
                # Update frames and stats with lock protection
                with self.lock:
                    self.last_frame = frame
                    self.annotated_frame = annotated_frame
                    self.stats.current_count = len(current_ids)
                    self.stats.total_tracked = max(self.stats.total_tracked, len(self.last_positions))
                    self.stats.last_updated = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                
                # Clean up tracking for IDs no longer in the frame
                ids_to_remove = set(self.last_positions.keys()) - current_ids
                if ids_to_remove:
                    # Clean up tracking data for IDs that have left the frame
                    for old_id in ids_to_remove:
                        # Remove from last_positions
                        self.last_positions.pop(old_id, None)
                        
                        # Clean up direction tracking attributes
                        direction_key = f"{old_id}_direction"
                        if hasattr(self, direction_key):
                            delattr(self, direction_key)
                
            except Empty:
                # Queue timeout, just continue to check is_running
                continue
            except Exception as e:
                print(f"Error in tracking loop for {self.config.name}: {e}")
                import traceback
                traceback.print_exc()
                time.sleep(1)  # Prevent rapid-fire errors
        
        print(f"Tracking loop stopped for {self.config.name}")

    def _get_side(self, p1, p2, point):
        """Determine which side of a line a point is on."""
        try:
            # Extract coordinates safely, handling any object type
            # For p1
            if hasattr(p1, 'x') and hasattr(p1, 'y'):
                x1, y1 = float(p1.x), float(p1.y)
            elif isinstance(p1, (tuple, list)) and len(p1) >= 2:
                x1, y1 = float(p1[0]), float(p1[1])
            else:
                print(f"Warning: Invalid point format for p1: {type(p1)}")
                return 0
                
            # For p2
            if hasattr(p2, 'x') and hasattr(p2, 'y'):
                x2, y2 = float(p2.x), float(p2.y)
            elif isinstance(p2, (tuple, list)) and len(p2) >= 2:
                x2, y2 = float(p2[0]), float(p2[1])
            else:
                print(f"Warning: Invalid point format for p2: {type(p2)}")
                return 0
                
            # For point
            if hasattr(point, 'x') and hasattr(point, 'y'):
                px, py = float(point.x), float(point.y)
            elif isinstance(point, (tuple, list)) and len(point) >= 2:
                px, py = float(point[0]), float(point[1])
            else:
                print(f"Warning: Invalid point format for point: {type(point)}")
                return 0
            
            # Calculate which side
            val = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)
            if val > 0: return 1
            if val < 0: return -1
            return 0
        except Exception as e:
            print(f"Error calculating side: {e}")
            return 0
    
    def get_stats(self) -> TrackingStats:
        """Get current tracking statistics."""
        with self.lock:
            return self.stats.copy(deep=True)
        
    def get_frame(self, annotated: bool = True):
        """Get the latest frame (annotated or raw)."""
        with self.lock:
            frame_to_return = self.annotated_frame if annotated else self.last_frame
            if frame_to_return is None: return None
            ret, buffer = cv2.imencode('.jpg', frame_to_return)
            return buffer.tobytes() if ret else None
    
    def get_raw_frame(self, annotated: bool = True):
        """Get the latest raw frame without compression."""
        with self.lock:
            return self.annotated_frame if annotated else self.last_frame

    def update_config(self, new_config: CameraConfig):
        """Update the tracker's configuration."""
        with self.lock:
            print(f"Updating camera {self.config.camera_id} configuration")
            print(f"Old line points: {self.config.line_points}")
            print(f"New line points: {new_config.line_points}")
            self.config = new_config

# --- CameraManager Class ---
class CameraManager:
    """Manages multiple camera trackers"""
    
    def __init__(self, model_path: str = 'yolov8n.pt', config_file: str = 'cameras.json', device: str = 'auto'):
        # Import torch at the top level
        import torch
        
        # Print CUDA information
        print(f"CUDA is available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"CUDA device count: {torch.cuda.device_count()}")
            print(f"Current CUDA device: {torch.cuda.current_device()}")
            print(f"Device name: {torch.cuda.get_device_name(0)}")
        
        # Force CUDA if available, with more specific device name
        if device == 'auto':
            self.device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
        else:
            self.device = device
        
        print(f"Selected device: {self.device}")
        
        # Load YOLO model with explicit device
        try:
            # Try different loading methods
            print(f"Loading model on {self.device}...")
            if self.device != 'cpu':
                # Method 1: Load directly to CUDA
                self.model = YOLO(model_path).cuda()
                
                # Verify model is on CUDA
                dummy = torch.zeros(1, 3, 640, 640).cuda()
                _ = self.model(dummy) # Run inference to verify
                
                print(f"Model device after loading: {next(self.model.parameters()).device}")
            else:
                self.model = YOLO(model_path)
        except Exception as e:
            print(f"Error loading model on GPU: {e}")
            print("Falling back to CPU")
            self.device = 'cpu'
            self.model = YOLO(model_path)
        
        self.config_file = config_file
        self.trackers: Dict[str, CameraTracker] = {}
        self.lock = threading.RLock()
        self._load_config()
        
        # Log which device is being used
        print(f"YOLO model loaded on device: {self.model.device}")

    def _load_config(self):
        """Load camera configurations from file."""
        try:
            with open(self.config_file, 'r') as f:
                configs_data = json.load(f)
            for camera_id, config_dict in configs_data.items():
                config = CameraConfig(**config_dict)
                self.add_camera(config, save_to_file=False)
        except FileNotFoundError:
            print("Config file not found. Starting with empty configuration.")
        except Exception as e:
            print(f"Error loading config: {e}")

    def save_config(self):
        """Save camera configurations to file."""
        with self.lock:
            configs = {cam_id: tracker.config.dict() for cam_id, tracker in self.trackers.items()}
            with open(self.config_file, 'w') as f:
                json.dump(configs, f, indent=4)

    def add_camera(self, config: CameraConfig, save_to_file: bool = True) -> CameraConfig:
        """Add a new camera and start its tracking."""
        # Create the tracker instance first
        tracker = CameraTracker(config, self.model)

        with self.lock:
            # Add the tracker to the dictionary
            self.trackers[config.camera_id] = tracker
            if save_to_file: self.save_config()
        
        # Start the tracker's threads AFTER adding it and releasing the lock
        tracker.start()
            
        return config
    
    def remove_camera(self, camera_id: str) -> bool:
        """Remove a camera by ID."""
        with self.lock:
            if camera_id in self.trackers:
                self.trackers[camera_id].stop()
                del self.trackers[camera_id]
                self.save_config()
                return True
            return False
    
    def update_camera(self, camera_id: str, camera_config: CameraConfig) -> Optional[CameraConfig]:
        """Update an existing camera configuration."""
        if camera_id not in self.trackers:
            return None
        
        old_config = self.trackers[camera_id].config
        print(f"Updating camera {camera_id} configuration")
        
        # Check if enabled status is changing
        if old_config.enabled != camera_config.enabled:
            print(f"Camera {camera_id} enabled status changing from {old_config.enabled} to {camera_config.enabled}")
            # You could add additional logic here if needed
        
        # Update the tracker's config
        self.trackers[camera_id].config = camera_config
        self.save_config()  # FIX: Changed from self._save_config() to self.save_config()
        
        return camera_config
    
    def get_camera(self, camera_id: str) -> Optional[CameraConfig]:
        """Get a camera configuration by ID."""
        with self.lock:
            if camera_id in self.trackers:
                return self.trackers[camera_id].config
            return None
    
    def get_all_cameras(self) -> List[CameraConfig]:
        """Get all camera configurations."""
        with self.lock:
            return [tracker.config for tracker in self.trackers.values()]

    def get_all_stats(self) -> List[TrackingStats]:
        """Get statistics for all cameras."""
        with self.lock:
            return [tracker.get_stats() for tracker in self.trackers.values()]

    def get_camera_stats(self, camera_id: str) -> Optional[TrackingStats]:
        """Get tracking statistics for a specific camera."""
        with self.lock:
            if camera_id in self.trackers:
                return self.trackers[camera_id].get_stats()
            return None
    
    def get_frame(self, camera_id: str, annotated: bool = True) -> Optional[bytes]:
        """Get the latest frame from a specific camera."""
        if camera_id in self.trackers:
            return self.trackers[camera_id].get_frame(annotated)
        return None

    def get_raw_frame(self, camera_id: str, annotated: bool = True):
        """Get the raw frame without JPEG compression for further processing."""
        if camera_id not in self.trackers:
            return None
            
        return self.trackers[camera_id].get_raw_frame(annotated)

    def shutdown(self):
        """Gracefully stop all camera trackers."""
        print("Shutting down all camera trackers...")
        with self.lock:
            for tracker in self.trackers.values():
                tracker.stop()
        print("All trackers have been signaled to stop.")