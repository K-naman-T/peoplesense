from fastapi import FastAPI, HTTPException, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2  # Add this import here
import time
import asyncio
import threading
from contextlib import asynccontextmanager
from typing import List

# Import configuration and logging
from app.config import settings
from app.logging_config import setup_logging
from app.models import CameraConfig, TrackingStats

# Setup logging
logger = setup_logging(settings.log_level, settings.log_file)

# Create a global state dictionary
app_state = {"start_time": time.time()}

# --- START: REFACTOR FOR LIFESPAN MANAGEMENT ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage the CameraManager's lifecycle with the application's startup and shutdown events.
    """
    logger.info("Application starting up...")
    from app.camera_manager import CameraManager
    
    # Initialize the CameraManager on startup
    app_state["camera_manager"] = CameraManager(
        model_path=settings.model_path,
        config_file=settings.config_file,
        device=settings.device
    )

    yield  # The application is now running

    logger.info("Application shutting down...")
    # Call the shutdown method on shutdown
    app_state["camera_manager"].shutdown()
    app_state.clear()


# Initialize FastAPI app
app = FastAPI(
    title="PeopleSense API",
    description="Backend API for the PeopleSense people tracking system",
    version="1.0.0",
    lifespan=lifespan,
)

# --- END: REFACTOR ---

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/cameras/", tags=["Cameras"], response_model=CameraConfig)
async def add_camera(camera: CameraConfig):
    """Add a new camera configuration."""
    # Access the manager from the app_state
    camera_manager = app_state["camera_manager"]
    new_config = camera_manager.add_camera(camera)
    return new_config


@app.get("/cameras/", tags=["Cameras"], response_model=List[CameraConfig])
async def get_all_cameras():
    """Get all camera configurations."""
    return app_state["camera_manager"].get_all_cameras()


@app.get("/cameras/{camera_id}", tags=["Cameras"], response_model=CameraConfig)
async def get_camera(camera_id: str):
    """Get a specific camera's configuration."""
    camera = app_state["camera_manager"].get_camera(camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@app.put("/cameras/{camera_id}", tags=["Cameras"], response_model=CameraConfig)
async def update_camera(camera_id: str, camera: CameraConfig):
    """Update camera configuration."""
    camera.camera_id = camera_id
    updated_camera = app_state["camera_manager"].update_camera(camera_id, camera)
    if not updated_camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return updated_camera


@app.delete("/cameras/{camera_id}", tags=["Cameras"], status_code=204)
async def delete_camera(camera_id: str):
    """Delete a camera."""
    if not app_state["camera_manager"].remove_camera(camera_id):
        raise HTTPException(status_code=404, detail="Camera not found")
    return Response(status_code=204)


@app.get("/stats/", response_model=List[TrackingStats])
async def get_all_stats():
    """Get tracking statistics for all cameras."""
    return app_state["camera_manager"].get_all_stats()


@app.get("/stats/{camera_id}", response_model=TrackingStats)
async def get_camera_stats(camera_id: str):
    """Get tracking statistics for a specific camera."""
    stats = app_state["camera_manager"].get_camera_stats(camera_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Camera or stats not found")
    return stats


# --- FIX: Update the route to match the frontend's request URL ---
@app.get("/cameras/{camera_id}/stream")
async def stream_camera(camera_id: str, annotated: bool = True):
    """Get the video stream for a camera (returns a single frame as JPEG)."""
    frame_bytes = app_state["camera_manager"].get_frame(camera_id, annotated)
    # This 'if' statement is being triggered
    if not frame_bytes:
        raise HTTPException(status_code=404, detail="Camera not found or stream unavailable")
    
    return Response(content=frame_bytes, media_type="image/jpeg")


@app.get("/cameras/{camera_id}/snapshot")
async def get_snapshot(camera_id: str, annotated: bool = True):
    """Get a single snapshot from the camera."""
    if camera_id not in app_state["camera_manager"].trackers:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    camera_tracker = app_state["camera_manager"].trackers[camera_id]
    if not camera_tracker.config.enabled:
        raise HTTPException(status_code=403, detail="Camera disabled")
    
    # Try to get frame directly from the tracker
    frame = None
    try:
        with camera_tracker.lock:
            if annotated and camera_tracker.annotated_frame is not None:
                frame = camera_tracker.annotated_frame
            elif camera_tracker.last_frame is not None:
                frame = camera_tracker.last_frame
    except Exception as e:
        print(f"Error getting frame: {e}")
    
    # If we don't have a frame from the tracker, try to get one directly
    if frame is None:
        try:
            import cv2
            # Try direct capture as a fallback
            cap = cv2.VideoCapture(camera_tracker.config.stream_url, cv2.CAP_FFMPEG)
            if cap.isOpened():
                ret, frame = cap.read()
                cap.release()
                if not ret:
                    frame = None
        except Exception as e:
            print(f"Error capturing snapshot directly: {e}")
    
    # If we still don't have a frame, return 404
    if frame is None:
        raise HTTPException(status_code=404, detail="Frame unavailable")
    
    # Convert to JPEG
    try:
        _, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        return Response(content=frame_bytes, media_type="image/jpeg")
    except Exception as e:
        print(f"Error encoding snapshot: {e}")
        raise HTTPException(status_code=500, detail="Error encoding frame")


@app.get("/cameras/{camera_id}/mjpeg")
async def mjpeg_stream(camera_id: str, annotated: bool = True):
    """Stream video using MJPEG format."""
    if camera_id not in app_state["camera_manager"].trackers:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    camera_tracker = app_state["camera_manager"].trackers[camera_id]
    if not camera_tracker.config.enabled:
        raise HTTPException(status_code=403, detail="Camera disabled")
    
    # Define boundary at function level - FIXED
    boundary = "frame"
    
    async def generate_frames():
        # Remove boundary definition from here since it's now at function level
        
        while True:
            # Get frame with a timeout to avoid blocking forever
            start_time = time.time()
            frame_bytes = None
            
            for _ in range(10):  # Try a few times to get a frame
                try:
                    if annotated:
                        with camera_tracker.lock:
                            if camera_tracker.annotated_frame is not None:
                                _, buffer = cv2.imencode('.jpg', camera_tracker.annotated_frame)
                                frame_bytes = buffer.tobytes()
                                break
                    else:
                        with camera_tracker.lock:
                            if camera_tracker.last_frame is not None:
                                _, buffer = cv2.imencode('.jpg', camera_tracker.last_frame)
                                frame_bytes = buffer.tobytes()
                                break
                except Exception as e:
                    print(f"Error encoding frame: {e}")
                
                # If we don't have a frame yet, wait a bit
                if frame_bytes is None:
                    await asyncio.sleep(0.1)
            
            # If we still don't have a frame, wait longer before trying again
            if frame_bytes is None:
                await asyncio.sleep(0.5)
                continue
                
            # Calculate adaptive frame rate (aim for 5-15 fps depending on processing time)
            elapsed = time.time() - start_time
            frame_delay = max(0.05, min(0.2, elapsed))  # Between 5-20 FPS
            
            # Send the MJPEG frame parts
            yield f"--{boundary}\r\n".encode()
            yield b"Content-Type: image/jpeg\r\n\r\n"
            yield frame_bytes
            yield b"\r\n"
            
            # Adaptive delay
            await asyncio.sleep(frame_delay)
    
    # MJPEG specific headers
    headers = {
        "Content-Type": f"multipart/x-mixed-replace; boundary={boundary}",
        "Cache-Control": "no-cache",
        "Connection": "close",
    }
    
    return StreamingResponse(
        generate_frames(), 
        headers=headers,
        media_type=f"multipart/x-mixed-replace;boundary={boundary}"
    )


# Add this route for diagnostic purposes
@app.get("/system/status")
async def system_status():
    """Returns system status information for debugging."""
    active_threads = threading.active_count()
    thread_names = [thread.name for thread in threading.enumerate()]
    
    # Get camera tracker status
    camera_status = {}
    if "camera_manager" in app_state:
        for camera_id, tracker in app_state["camera_manager"].trackers.items():
            camera_status[camera_id] = {
                "enabled": tracker.config.enabled if hasattr(tracker, "config") else False,
                "processing": tracker.is_processing if hasattr(tracker, "is_processing") else False,
                "last_frame_time": time.time() - tracker.last_frame_time if hasattr(tracker, "last_frame_time") else None,
            }
    
    return {
        "active_threads": active_threads,
        "thread_names": thread_names,
        "cameras": camera_status,
        "uptime": time.time() - app_state.get("start_time", time.time()),
    }

# Add this at app startup
@app.on_event("startup")
async def startup_event():
    app_state["start_time"] = time.time()


@app.get("/system/gpu-status")
async def gpu_status():
    """Returns GPU status information."""
    try:
        # Check if torch is using CUDA
        import torch
        cuda_available = torch.cuda.is_available()
        cuda_device_count = torch.cuda.device_count() if cuda_available else 0
        cuda_device_name = torch.cuda.get_device_name(0) if cuda_available and cuda_device_count > 0 else "N/A"
        
        # Get the device being used by the model
        model_device = str(app_state["camera_manager"].model.device)
        
        return {
            "cuda_available": cuda_available,
            "cuda_device_count": cuda_device_count,
            "cuda_device_name": cuda_device_name,
            "model_device": model_device,
            "is_using_gpu": "cuda" in model_device.lower()
        }
    except Exception as e:
        return {
            "error": f"Error getting GPU status: {str(e)}",
            "cuda_available": False
        }


@app.get("/system/health")
async def system_health():
    """Health check endpoint for monitoring systems"""
    try:
        # Check if camera manager exists and is functioning
        if "camera_manager" not in app_state:
            return {
                "status": "unhealthy",
                "message": "Camera manager not initialized"
            }
        
        # Check GPU status if using CUDA
        device_info = {}
        try:
            import torch
            if torch.cuda.is_available():
                device_info = {
                    "device_name": torch.cuda.get_device_name(0),
                    "memory_allocated_mb": torch.cuda.memory_allocated() / (1024*1024),
                    "memory_reserved_mb": torch.cuda.memory_reserved() / (1024*1024),
                }
        except Exception as e:
            device_info = {"error": str(e)}
            
        # Get batch processor metrics if available
        batch_metrics = {}
        if hasattr(app_state["camera_manager"], "batch_processor") and app_state["camera_manager"].batch_processor:
            batch_metrics = app_state["camera_manager"].batch_processor.get_metrics()
        
        # Get system metrics
        import psutil
        system_metrics = {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage('/').percent,
        }
        
        # Get camera metrics
        camera_metrics = {
            "total_cameras": len(app_state["camera_manager"].trackers),
            "enabled_cameras": sum(1 for t in app_state["camera_manager"].trackers.values() 
                                 if t.config.enabled)
        }
        
        return {
            "status": "healthy",
            "timestamp": time.time(),
            "uptime": time.time() - app_state.get("start_time", time.time()),
            "system": system_metrics,
            "device": device_info,
            "batch_processor": batch_metrics,
            "cameras": camera_metrics
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }


@app.get("/system/camera-metrics/{camera_id}")
async def camera_metrics(camera_id: str):
    """Get detailed metrics for a specific camera"""
    if "camera_manager" not in app_state or camera_id not in app_state["camera_manager"].trackers:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    tracker = app_state["camera_manager"].trackers[camera_id]
    
    # Return key performance metrics
    return {
        "camera_id": camera_id,
        "enabled": tracker.config.enabled,
        "fps": tracker.fps,
        "processing_latency": tracker.processing_latency * 1000,  # Convert to ms
        "frames_processed": tracker.frames_processed,
        "queue_size": tracker.frame_queue.qsize() if hasattr(tracker.frame_queue, "qsize") else None,
        "people_counted_in": tracker.stats.people_in,
        "people_counted_out": tracker.stats.people_out,
        "current_count": tracker.stats.current_count,
        "last_updated": tracker.stats.last_updated
    }


@app.get("/system/frame-status/{camera_id}")
async def frame_status(camera_id: str):
    """Debug endpoint to check frame status for a camera"""
    if "camera_manager" not in app_state or camera_id not in app_state["camera_manager"].trackers:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    tracker = app_state["camera_manager"].trackers[camera_id]
    
    return {
        "camera_id": camera_id,
        "has_last_frame": tracker.last_frame is not None,
        "has_annotated_frame": tracker.annotated_frame is not None,
        "frame_queue_size": tracker.frame_queue.qsize() if hasattr(tracker.frame_queue, "qsize") else None,
        "is_running": tracker.is_running,
        "processing_thread_alive": tracker.processing_thread is not None and tracker.processing_thread.is_alive() if tracker.processing_thread else False,
    }


@app.get("/system/camera-debug/{camera_id}")
async def camera_debug(camera_id: str):
    """Extended debug information for a camera"""
    if "camera_manager" not in app_state:
        return {"error": "Camera manager not initialized"}
        
    if camera_id not in app_state["camera_manager"].trackers:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    tracker = app_state["camera_manager"].trackers[camera_id]
    
    # Try to get a frame directly
    has_frame = False
    frame_shape = None
    try:
        with tracker.lock:
            if tracker.last_frame is not None:
                has_frame = True
                frame_shape = tracker.last_frame.shape
    except:
        pass
    
    return {
        "camera_id": camera_id,
        "name": tracker.config.name,
        "stream_url": tracker.config.stream_url,
        "enabled": tracker.config.enabled,
        "is_running": tracker.is_running,
        "has_frame": has_frame,
        "frame_shape": frame_shape,
        "threads": {
            "reader": {
                "alive": tracker.reader_thread.is_alive() if tracker.reader_thread else False,
                "name": tracker.reader_thread.name if tracker.reader_thread else None
            },
            "processor": {
                "alive": tracker.processing_thread.is_alive() if tracker.processing_thread else False,
                "name": tracker.processing_thread.name if tracker.processing_thread else None
            }
        }
    }