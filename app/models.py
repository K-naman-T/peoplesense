from pydantic import BaseModel, Field
from typing import List, Optional, Union
from uuid import uuid4
import time


class Point(BaseModel):
    x: int
    y: int


# This model seems unused in the current implementation but is fine.
class LineDefinition(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    points: List[Point]


class CameraConfig(BaseModel):
    # Use a single, consistent ID field.
    camera_id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    # Use a single, clear URL field. It can be a string (RTSP/HTTP) or int (device index).
    stream_url: Union[str, int]
    enabled: bool = True
    # This is what the CameraTracker uses. It supports one line.
    line_points: List[Point] = []

    # The 'lines' field and complex validators are no longer needed.


class CameraList(BaseModel):
    cameras: List[CameraConfig] = []


class TrackingStats(BaseModel):
    camera_id: str
    camera_name: str  # Add name for easier use in the frontend
    people_in: int = 0
    people_out: int = 0
    current_count: int = 0
    total_tracked: int = 0  # Add a field for total unique tracks
    last_updated: Optional[str] = None  # Add a timestamp


# This model seems unused in the current implementation but is fine.
class LineCountEvent(BaseModel):
    camera_id: str
    line_id: str
    object_id: str
    direction: str
    timestamp: float
    position: Point


class ErrorResponse(BaseModel):
    detail: str