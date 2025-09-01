from fastapi import FastAPI, HTTPException, BackgroundTasks, Response, Query, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
import json
import cv2
import numpy as np
import io
import time
from typing import List, Dict, Optional

from app.models import CameraConfig, TrackingStats, LineDefinition, CameraList, Point
from app.camera_manager import CameraManager

app = FastAPI(
    title="People Tracking API",
    description="API for tracking people across multiple camera streams",
    version="1.0.0"
)

# Add CORS middleware to allow cross-origin requests from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production to be more specific
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the camera manager
camera_manager = CameraManager(model_path='yolov8n.pt')


@app.get("/", tags=["Root"])
async def root():
    return {"message": "People Tracking API is running"}


# Add this exception handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"Validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": json.loads(exc.json())}
    )


# Update the add_camera endpoint for more detailed logging

@app.post("/cameras/", tags=["Cameras"], response_model=CameraConfig)
async def add_camera(request: Request):
    """Add a new camera to the tracking system"""
    try:
        # Get the raw data
        body = await request.body()
        print(f"Raw request body: {body.decode()}")
        
        # Parse the JSON data
        data = await request.json()
        print(f"Parsed JSON data: {data}")
        
        # Create a camera config
        camera = CameraConfig(**data)
        print(f"Created camera config: {camera.model_dump()}")
        print(f"Camera URL: {camera.url}, Stream URL: {camera.stream_url}")
        
        # Try to add the camera
        try:
            camera_id = camera_manager.add_camera(camera)
            print(f"Added camera with ID: {camera_id}")
            
            # Update the id and camera_id fields for consistent response
            camera.id = camera_id
            camera.camera_id = camera_id
            
            return camera
        except Exception as e:
            print(f"Error in camera_manager.add_camera: {str(e)}")
            import traceback
            print(traceback.format_exc())
            raise HTTPException(status_code=400, detail=f"Failed to add camera: {str(e)}")
            
    except Exception as e:
        print(f"Error processing camera data: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Failed to process camera data: {str(e)}")


@app.get("/cameras/", tags=["Cameras"], response_model=CameraList)
async def get_cameras():
    """Get all configured cameras"""
    cameras = camera_manager.get_all_cameras()
    return CameraList(cameras=cameras)


@app.get("/cameras/{camera_id}", tags=["Cameras"], response_model=CameraConfig)
async def get_camera(camera_id: str):
    """Get camera configuration by ID"""
    camera = camera_manager.get_camera(camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    return camera


@app.put("/cameras/{camera_id}", tags=["Cameras"], response_model=CameraConfig)
async def update_camera(camera_id: str, camera: CameraConfig):
    """Update camera configuration"""
    # Ensure the path ID and body ID match
    camera.id = camera_id
    
    success = camera_manager.update_camera(camera_id, camera)
    if not success:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    return camera


@app.delete("/cameras/{camera_id}", tags=["Cameras"])
async def delete_camera(camera_id: str):
    """Delete a camera from the system"""
    success = camera_manager.remove_camera(camera_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    return {"message": f"Camera {camera_id} deleted"}


@app.post("/cameras/{camera_id}/lines", tags=["Lines"], response_model=LineDefinition)
async def add_camera_line(camera_id: str, line: LineDefinition):
    """Add a counting line to a camera"""
    try:
        print(f"Adding line to camera {camera_id}: {line}")
        # Ensure the camera_id in URL matches the one in the line object
        if line.camera_id != camera_id:
            line.camera_id = camera_id
            
        # The add_line method returns a boolean, not a line ID
        success = camera_manager.add_line(camera_id, line)
        if not success:
            raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
        
        return line
    except Exception as e:
        import traceback
        print(f"Error adding line: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error adding line: {str(e)}")


@app.get("/cameras/{camera_id}/lines", tags=["Lines"], response_model=List[LineDefinition])
async def get_lines(camera_id: str):
    """Get all counting lines for a camera"""
    camera = camera_manager.get_camera(camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    return camera.lines


@app.delete("/cameras/{camera_id}/lines/{line_id}", tags=["Lines"])
async def delete_line(camera_id: str, line_id: str):
    """Delete a counting line from a camera"""
    success = camera_manager.remove_line(camera_id, line_id)
    if not success:
        raise HTTPException(
            status_code=404, 
            detail=f"Camera {camera_id} or line {line_id} not found"
        )
    
    return {"message": f"Line {line_id} deleted from camera {camera_id}"}


@app.get("/cameras/{camera_id}/stats", tags=["Statistics"], response_model=TrackingStats)
async def get_camera_stats(camera_id: str):
    """Get current tracking statistics for a camera"""
    stats = camera_manager.get_camera_stats(camera_id)
    if not stats:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    return stats


# Add these imports
import cv2
import asyncio
from starlette.responses import StreamingResponse


@app.get("/cameras/{camera_id}/snapshot", tags=["Cameras"])
async def get_camera_snapshot(
    camera_id: str, 
    annotated: bool = Query(True, description="Whether to show tracking annotations")
):
    """Get a single frame snapshot from a camera"""
    try:
        # Check if camera exists
        camera_config = camera_manager.get_camera(camera_id)
        if not camera_config:
            raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
        
        # Use the camera_manager.get_frame() method instead of calling methods on CameraConfig
        frame_bytes = camera_manager.get_frame(camera_id, annotated=annotated)
        if frame_bytes is None:
            raise HTTPException(status_code=500, detail="Could not get frame from camera")
        
        # Return as image response with no-cache headers
        response = StreamingResponse(
            iter([frame_bytes]), 
            media_type="image/jpeg"
        )
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        return response
    except Exception as e:
        print(f"Error getting snapshot: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error getting snapshot: {str(e)}")


async def generate_frames(camera_id: str, annotated: bool = True):
    """Generate frames for video streaming"""
    while True:
        frame_data = camera_manager.get_frame(camera_id, annotated=annotated)
        if not frame_data:
            await asyncio.sleep(0.1)  # Wait a bit before trying again
            continue
        
        # Yield the frame in MJPEG format
        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n'
        )
        
        # Control frame rate
        await asyncio.sleep(0.033)  # ~30 FPS


@app.get("/cameras/{camera_id}/stream", tags=["Video"])
async def stream_camera(camera_id: str, annotated: bool = True):
    """Stream video from a camera with MJPEG"""
    camera = camera_manager.get_camera(camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    return StreamingResponse(
        generate_frames(camera_id, annotated),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


# Additional imports needed for async streaming
import asyncio

# Add required import at the top of the file
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

def get_frame(self, camera_id: str, annotated: bool = True) -> Optional[bytes]:
    """Get the latest frame from a camera"""
    camera = self.get_camera(camera_id)
    if not camera:
        return None
        
    # Get the frame from the camera object
    frame = camera.get_frame(annotated)
    if frame is None:
        return None
    
    # Make sure frame is properly encoded as JPEG
    success, buffer = cv2.imencode(".jpg", frame)
    if not success:
        return None
    
    return buffer.tobytes()

# Add this route to redirect to the correct endpoint
@app.get("/stats/{camera_id}", tags=["Statistics"], response_model=TrackingStats)
async def get_stats_redirect(camera_id: str):
    """Compatibility route for stats"""
    stats = camera_manager.get_camera_stats(camera_id)
    if not stats:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    return stats

@app.get("/cameras/{camera_id}/debug", tags=["Cameras"])
async def debug_camera(camera_id: str):
    """Debug camera information"""
    camera = camera_manager.get_camera(camera_id)
    if not camera:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    return {
        "camera_id": camera_id,
        "is_running": camera.is_running if hasattr(camera, "is_running") else None,
        "has_current_frame": camera.current_frame is not None if hasattr(camera, "current_frame") else None,
        "enabled": camera.enabled,
        "url": camera.url
    }