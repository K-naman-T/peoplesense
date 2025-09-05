from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from contextlib import asynccontextmanager  # Import asynccontextmanager

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
    # Initialize the CameraManager on startup
    app_state["camera_manager"] = CameraManager(model_path='yolov8n.pt', config_file='cameras.json')

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