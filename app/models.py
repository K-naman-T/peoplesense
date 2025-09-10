from pydantic import BaseModel, Field
from typing import List, Optional, Union, Tuple
from uuid import uuid4
import time
import cv2
import numpy as np  # Added missing import for numpy

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
    # List of tuples (percent coordinates, 0-100 range)
    line_points: List[Tuple[int, int]] = []


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


# Helper function to determine which side of a line a point is on
def get_side(p1, p2, point):
    """
    Determine which side of a line a point is on.
    Returns: 
     1 if point is on one side
    -1 if point is on the other side
     0 if point is on the line
    """
    val = (p2[0] - p1[0]) * (point[1] - p1[1]) - (p2[1] - p1[1]) * (point[0] - p1[0])
    if val > 0:
        return 1
    elif val < 0:
        return -1
    return 0


def draw_counting_line(config, frame_width, frame_height, annotated_frame, boxes, ids, last_positions, counted_ids, stats):
    """
    Draw the counting line and detect people crossing it
    
    Args:
        config: CameraConfig object containing line_points
        frame_width: Width of the frame
        frame_height: Height of the frame
        annotated_frame: Frame to draw on
        boxes: Bounding boxes of detected people
        ids: IDs of detected people
        last_positions: Dict mapping object IDs to previous positions
        counted_ids: Set of IDs that have already been counted
        stats: TrackingStats object to update
    """
    if config.line_points and len(config.line_points) >= 2:
        # Unpack tuples directly
        x1, y1 = config.line_points[0]  
        x2, y2 = config.line_points[1]
        
        # Convert percentage to pixel coordinates
        p1 = (x1 * frame_width // 100, y1 * frame_height // 100)
        p2 = (x2 * frame_width // 100, y2 * frame_height // 100)
        
        # Draw the counting line
        cv2.line(annotated_frame, p1, p2, (255, 0, 0), 2)

        # Check for people crossing the line
        for box, obj_id in zip(boxes, ids):
            # Convert obj_id to string for consistent keys
            str_id = str(obj_id)
            
            # Get current position (center of bounding box)
            x1_box, y1_box, x2_box, y2_box = box
            center = ((x1_box + x2_box) // 2, (y1_box + y2_box) // 2)
            
            # Get previous position if available
            prev_pos = last_positions.get(str_id)
            
            # Update position tracking
            last_positions[str_id] = center
            
            # Check for line crossing
            if prev_pos and str_id not in counted_ids:
                side_before = get_side(p1, p2, prev_pos)
                side_after = get_side(p1, p2, center)
                
                if side_before != side_after:
                    # Line was crossed
                    counted_ids.add(str_id)
                    
                    # Determine direction (negative to positive is "in", positive to negative is "out")
                    if side_before < 0 and side_after > 0:
                        stats.people_in += 1
                        # Draw green arrow for "in" direction
                        cv2.arrowedLine(annotated_frame, prev_pos, center, (0, 255, 0), 2)
                    elif side_before > 0 and side_after < 0:
                        stats.people_out += 1
                        # Draw red arrow for "out" direction
                        cv2.arrowedLine(annotated_frame, prev_pos, center, (0, 0, 255), 2)