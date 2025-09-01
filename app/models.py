from typing import Dict, List, Optional, Tuple, Union, Any
from pydantic import BaseModel, Field, field_validator, model_validator
import uuid


class Point(BaseModel):
    x: int
    y: int


class LineDefinition(BaseModel):
    camera_id: str
    points: List[Point]
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))  # Add this line


class CameraConfig(BaseModel):
    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()))
    camera_id: Optional[str] = None
    name: str
    url: Optional[Any] = None  # Backend field
    stream_url: Optional[Any] = None  # Frontend field
    enabled: bool = True
    lines: List[LineDefinition] = []

    @model_validator(mode='after')
    def ensure_id_and_url(self):
        # Ensure either id or camera_id is populated
        if not self.id and self.camera_id:
            self.id = self.camera_id
        elif not self.camera_id and self.id:
            self.camera_id = self.id
            
        # Ensure either url or stream_url is populated
        if not self.url and self.stream_url is not None:
            self.url = self.stream_url
        elif not self.stream_url and self.url is not None:
            self.stream_url = self.url
            
        return self

    @field_validator('url', 'stream_url', mode='before')
    @classmethod
    def validate_url(cls, v):
        # Convert string numbers to integers
        if isinstance(v, str) and v.isdigit():
            return int(v)
        return v

    class Config:
        populate_by_name = True


class CameraList(BaseModel):
    cameras: List[CameraConfig] = []


class TrackingStats(BaseModel):
    camera_id: str
    people_in: int = 0
    people_out: int = 0
    current_count: int = 0
    lines: Dict[str, Dict[str, int]] = {}


class LineCountEvent(BaseModel):
    camera_id: str
    line_id: str
    object_id: str
    direction: str  # 'in' or 'out'
    timestamp: float
    position: Point


class ErrorResponse(BaseModel):
    detail: str