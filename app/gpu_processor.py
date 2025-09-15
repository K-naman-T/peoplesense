import threading
import time
import torch
import numpy as np
from queue import Queue, Empty
from typing import Dict, List, Optional
from ultralytics import YOLO

class BatchProcessor:
    """Centralized GPU batch processor for multiple camera frames"""
    
    def __init__(self, model: YOLO, batch_size: int = 4, max_queue_size: int = 16):
        self.model = model
        self.batch_size = batch_size
        self.is_running = False
        self.processing_thread = None
        
        # Input and output queues
        self.input_queue = Queue(maxsize=max_queue_size)
        self.output_queues: Dict[str, Queue] = {}
        
        # Performance metrics
        self.processed_frames = 0
        self.processing_times: List[float] = []
        self.last_batch_time = 0
        self.lock = threading.RLock()
    
    def start(self):
        """Start the batch processing thread"""
        if self.is_running:
            return
        self.is_running = True
        self.processing_thread = threading.Thread(target=self._processing_loop, daemon=True)
        self.processing_thread.start()
        print(f"GPU Batch processor started on {self.model.device}")
    
    def stop(self):
        """Stop the batch processing thread"""
        self.is_running = False
        if self.processing_thread:
            self.processing_thread.join(timeout=5)
            
    def register_camera(self, camera_id: str) -> Queue:
        """Register a camera to receive processed results"""
        with self.lock:
            if camera_id not in self.output_queues:
                self.output_queues[camera_id] = Queue(maxsize=4)
            return self.output_queues[camera_id]
    
    def unregister_camera(self, camera_id: str):
        """Unregister a camera"""
        with self.lock:
            if camera_id in self.output_queues:
                del self.output_queues[camera_id]
    
    def submit_frame(self, camera_id: str, frame: np.ndarray, timestamp: float) -> bool:
        """Submit a frame for processing"""
        try:
            # Non-blocking put with timeout
            self.input_queue.put((camera_id, frame, timestamp), timeout=0.5)
            return True
        except Exception:
            return False
    
    def _processing_loop(self):
        """Main processing loop to batch process frames"""
        batch_frames = []
        batch_ids = []
        batch_timestamps = []
        
        while self.is_running:
            try:
                # Collect frames for batch processing
                while len(batch_frames) < self.batch_size:
                    try:
                        camera_id, frame, timestamp = self.input_queue.get(timeout=0.05)
                        batch_frames.append(frame)
                        batch_ids.append(camera_id)
                        batch_timestamps.append(timestamp)
                    except Empty:
                        # Process current batch if we have any frames,
                        # otherwise keep waiting for new frames
                        if batch_frames:
                            break
                
                if not batch_frames:
                    time.sleep(0.01)
                    continue
                
                # Process batch on GPU
                start_time = time.time()
                
                try:
                    # Convert frames to tensors and move to GPU
                    with torch.cuda.amp.autocast(enabled=True):
                        results = self.model.track(
                            source=batch_frames,
                            persist=True, 
                            classes=[0],  # Person class
                            verbose=False
                        )
                    
                    # Distribute results to appropriate output queues
                    for i, result in enumerate(results):
                        camera_id = batch_ids[i]
                        if camera_id in self.output_queues:
                            # Non-blocking put - drop result if queue is full (real-time system)
                            try:
                                self.output_queues[camera_id].put(
                                    (result, batch_frames[i], batch_timestamps[i]), 
                                    block=False
                                )
                            except Exception:
                                pass
                
                except Exception as e:
                    print(f"Error in batch processing: {e}")
                
                # Record metrics
                elapsed = time.time() - start_time
                with self.lock:
                    self.processed_frames += len(batch_frames)
                    self.last_batch_time = elapsed
                    self.processing_times.append(elapsed)
                    if len(self.processing_times) > 100:
                        self.processing_times.pop(0)
                
                # Clear batch
                batch_frames = []
                batch_ids = []
                batch_timestamps = []
                
            except Exception as e:
                print(f"Error in batch processing loop: {e}")
                time.sleep(0.1)
    
    def get_metrics(self) -> dict:
        """Get processing performance metrics"""
        with self.lock:
            avg_time = sum(self.processing_times) / max(len(self.processing_times), 1)
            return {
                "processed_frames": self.processed_frames,
                "avg_processing_time": avg_time,
                "last_batch_time": self.last_batch_time,
                "fps": 1.0 / max(avg_time / self.batch_size, 0.001),
                "queue_size": self.input_queue.qsize(),
                "batch_size": self.batch_size,
                "cameras": len(self.output_queues)
            }