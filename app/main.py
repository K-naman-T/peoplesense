from fastapi import FastAPI, HTTPException, Response, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from contextlib import asynccontextmanager  # Import asynccontextmanager
import asyncio
import cv2  # Import OpenCV for image processing
import time
import threading

from app.models import CameraConfig, TrackingStats, CameraList
from app.camera_manager import CameraManager

# --- START: REFACTOR FOR LIFESPAN MANAGEMENT ---

# This dictionary will hold our camera_manager instance
app_state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manage the CameraManager's lifecycle with the application's startup and shutdown events.
    """
    print("Application starting up...")
    # Initialize the CameraManager on startup with GPU support
    app_state["camera_manager"] = CameraManager(model_path='yolov8n.pt', 
                                              config_file='cameras.json',
                                              device='auto')  # 'auto' will use GPU if available

    yield  # The application is now running

    print("Application shutting down...")
    # Call the shutdown method on shutdown
    app_state["camera_manager"].shutdown()
    app_state.clear()


# Pass the lifespan manager to the FastAPI app
app = FastAPI(title="People Tracking API", version="1.0.0", lifespan=lifespan)

# --- END: REFACTOR ---

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    """Get a single snapshot frame from a camera."""
    frame_bytes = app_state["camera_manager"].get_frame(camera_id, annotated)
    if not frame_bytes:
        raise HTTPException(status_code=404, detail="Camera not found or frame unavailable")
    
    # Return the single frame as a JPEG image
    return Response(content=frame_bytes, media_type="image/jpeg")


@app.get("/cameras/{camera_id}/mjpeg")
async def mjpeg_stream(
    camera_id: str, 
    annotated: bool = True, 
    quality: str = "medium",
    background_tasks: BackgroundTasks = None
):
    """Stream video using MJPEG format with quality control."""
    if camera_id not in app_state["camera_manager"].trackers:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    # Check if camera is enabled
    camera_config = app_state["camera_manager"].get_camera(camera_id)
    if not camera_config or not camera_config.enabled:
        raise HTTPException(status_code=403, detail="Camera is disabled")
    
    # Map quality string to JPEG quality value
    quality_map = {
        "low": 30,     # Low quality, smallest size
        "medium": 70,  # Default quality
        "high": 95     # High quality, largest size
    }
    jpeg_quality = quality_map.get(quality, 70)
    
    boundary = "frame"
    
    async def generate_frames():
        try:
            frame_count = 0
            start_time = time.time()
            
            while True:
                # Add timeout for frame retrieval
                frame = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None, 
                        app_state["camera_manager"].get_raw_frame, 
                        camera_id, 
                        annotated
                    ),
                    timeout=1.0
                )
                
                if frame is None:
                    await asyncio.sleep(0.1)
                    continue
                
                # Compress with specified quality
                ret, buffer = cv2.imencode(
                    '.jpg', 
                    frame, 
                    [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality]
                )
                
                if not ret:
                    await asyncio.sleep(0.1)
                    continue
                    
                frame_bytes = buffer.tobytes()
                
                # Calculate adaptive delay based on client bandwidth
                frame_count += 1
                if frame_count % 30 == 0:
                    elapsed = time.time() - start_time
                    fps = min(30, max(5, frame_count / elapsed if elapsed > 0 else 20))
                    frame_delay = 1 / fps
                else:
                    frame_delay = 0.05  # 20fps default
                    
                yield f"--{boundary}\r\n".encode()
                yield b"Content-Type: image/jpeg\r\n\r\n"
                yield frame_bytes
                yield b"\r\n"
                
                # Adaptive frame rate
                await asyncio.sleep(frame_delay)
                
        except asyncio.CancelledError:
            print(f"MJPEG stream for camera {camera_id} was cancelled")
        except Exception as e:
            print(f"Error in MJPEG stream for {camera_id}: {e}")
    
    headers = {
        "Content-Type": f"multipart/x-mixed-replace; boundary={boundary}",
        "Cache-Control": "no-cache",
        "Connection": "close",  # Important to prevent hanging connections
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