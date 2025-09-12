import cv2
import time
import numpy as np
from ultralytics import YOLO
import sys

# Configuration
VIDEO_SOURCE = 'test_video.mp4'  # Default to video file if available
LINE_START = None  # Will be set by user clicks
LINE_END = None    # Will be set by user clicks
CONFIDENCE_THRESHOLD = 0.3

# Global variables for line drawing
drawing_line = False
line_points = []

def mouse_callback(event, x, y, flags, param):
    """Handle mouse events for drawing the counting line."""
    global LINE_START, LINE_END, drawing_line, line_points
    
    if event == cv2.EVENT_LBUTTONDOWN:
        if len(line_points) < 2:
            line_points.append((x, y))
            print(f"Point {len(line_points)} set at: ({x}, {y})")
            
            if len(line_points) == 1:
                LINE_START = line_points[0]
                print("Click to set the second point of the line")
            elif len(line_points) == 2:
                LINE_END = line_points[1]
                drawing_line = True
                print("Line drawn! Counting will now begin.")
                print(f"Line: {LINE_START} to {LINE_END}")

def main():
    global LINE_START, LINE_END, drawing_line, line_points
    
    # Check for command line args (video file)
    if len(sys.argv) > 1:
        VIDEO_SOURCE = sys.argv[1]
        print(f"Using video source: {VIDEO_SOURCE}")
    else:
        # Try to use test_video.mp4, then fallback to webcam
        import os
        if os.path.exists('test_video.mp4'):
            VIDEO_SOURCE = 'test_video.mp4'
            print("Using test_video.mp4")
        else:
            # Try different camera indices
            for cam_index in [0, 1, 2]:
                print(f"Trying camera at index {cam_index}...")
                cap = cv2.VideoCapture(cam_index)
                if cap.isOpened():
                    VIDEO_SOURCE = cam_index
                    print(f"Successfully opened camera at index {cam_index}")
                    cap.release()
                    break
            else:  # This runs if no break occurred in the loop
                print("Could not find any available camera. Please check connections.")
                return
    
    # Load YOLO model
    model = YOLO("yolov8n.pt")
    
    # Initialize video capture
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    if not cap.isOpened():
        print(f"Error: Could not open video source {VIDEO_SOURCE}")
        return
    
    # Get video dimensions
    ret, frame = cap.read()
    if not ret:
        print("Error: Couldn't read frame from video source")
        return
    
    frame_height, frame_width = frame.shape[:2]
    
    # Create window and set mouse callback
    cv2.namedWindow('Line Counting Test')
    cv2.setMouseCallback('Line Counting Test', mouse_callback)
    
    # Reset video to beginning if it's a file
    if isinstance(VIDEO_SOURCE, str):
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    
    # Initialize tracking variables
    people_in = 0
    people_out = 0
    last_positions = {}
    counted_ids = set()
    
    print("Starting video processing...")
    print("Click to set the first point of the counting line")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("End of video stream")
            # Loop video if it's a file
            if isinstance(VIDEO_SOURCE, str):
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if not ret:  # If still can't read, then break
                    break
            else:
                break
        
        # Create a copy for drawing
        display_frame = frame.copy()
        
        # Draw instruction text if line is not yet drawn
        if not drawing_line:
            cv2.putText(display_frame, "Click to draw counting line", (20, 40),
                      cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            # Draw points placed so far
            for i, point in enumerate(line_points):
                cv2.circle(display_frame, point, 7, (255, 255, 255), -1)
                cv2.circle(display_frame, point, 4, (0, 0, 255), -1)
                cv2.putText(display_frame, f"P{i+1}", (point[0]+10, point[1]),
                          cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Process people tracking and counting only after the line is drawn
        if drawing_line:
            # Process frame with YOLO (track people)
            results = model.track(frame, persist=True, classes=[0], verbose=False, conf=CONFIDENCE_THRESHOLD)
            
            # Draw the counting line (make it very visible)
            cv2.line(display_frame, LINE_START, LINE_END, (255, 255, 255), 5)  # White border
            cv2.line(display_frame, LINE_START, LINE_END, (0, 0, 255), 2)      # Red line
            
            # Add endpoint circles for better visibility
            cv2.circle(display_frame, LINE_START, 7, (255, 255, 255), -1)  # White circle
            cv2.circle(display_frame, LINE_START, 4, (0, 0, 255), -1)      # Red circle
            cv2.circle(display_frame, LINE_END, 7, (255, 255, 255), -1)    # White circle
            cv2.circle(display_frame, LINE_END, 4, (0, 0, 255), -1)        # Red circle
            
            # Process people detection
            if results[0].boxes.id is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
                ids = results[0].boxes.id.cpu().numpy().astype(int)
                
                # Current IDs in this frame
                current_ids = set()
                
                # Process each detected person
                for box, obj_id in zip(boxes, ids):
                    x1_box, y1_box, x2_box, y2_box = box
                    center = ((x1_box + x2_box) // 2, (y1_box + y2_box) // 2)
                    str_id = str(obj_id)
                    current_ids.add(str_id)
                    
                    # Draw bounding box
                    cv2.rectangle(display_frame, (x1_box, y1_box), (x2_box, y2_box), (0, 255, 0), 2)
                    cv2.putText(display_frame, f"ID: {str_id}", (x1_box, y1_box - 10), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                    
                    # Check for line crossing if we have previous position
                    prev_pos = last_positions.get(str_id)
                    if prev_pos and str_id not in counted_ids:
                        # Determine which side of the line the points are on
                        side_before = get_side(LINE_START, LINE_END, prev_pos)
                        side_after = get_side(LINE_START, LINE_END, center)
                        
                        # If sides are different, a crossing has occurred
                        if side_before != 0 and side_after != 0 and side_before != side_after:
                            counted_ids.add(str_id)
                            
                            # Visualize the crossing direction with a thick line
                            if side_before < 0 and side_after > 0:
                                # Person moving from negative side to positive side
                                cv2.arrowedLine(display_frame, prev_pos, center, (0, 255, 0), 4)
                                people_in += 1
                                print(f"Person {str_id} entered")
                            elif side_before > 0 and side_after < 0:
                                # Person moving from positive side to negative side
                                cv2.arrowedLine(display_frame, prev_pos, center, (0, 0, 255), 4)
                                people_out += 1
                                print(f"Person {str_id} exited")
                    
                    # Update position for next frame
                    last_positions[str_id] = center
                
                # Clean up tracking for IDs no longer detected
                last_positions = {k: v for k, v in last_positions.items() if k in current_ids}
            
            # Add stats overlay to frame
            cv2.rectangle(display_frame, (10, 10), (200, 90), (0, 0, 0), -1)  # Black background
            cv2.putText(display_frame, f"IN:  {people_in}", (20, 40), 
                      cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.putText(display_frame, f"OUT: {people_out}", (20, 80), 
                      cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        
        # Show the frame
        cv2.imshow('Line Counting Test', display_frame)
        
        # Break on 'q' key
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('r'):  # Reset line
            LINE_START = None
            LINE_END = None
            drawing_line = False
            line_points = []
            print("Line reset. Click to set the first point again.")
        
    # Clean up
    cap.release()
    cv2.destroyAllWindows()
    
    print("\nFinal counts:")
    print(f"People IN:  {people_in}")
    print(f"People OUT: {people_out}")

def get_side(p1, p2, point):
    """Determine which side of a line a point is on."""
    val = (p2[0] - p1[0]) * (point[1] - p1[1]) - (p2[1] - p1[1]) * (point[0] - p1[0])
    if val > 0: return 1  # Point is on "positive" side
    if val < 0: return -1  # Point is on "negative" side
    return 0  # Point is on the line

if __name__ == "__main__":
    main()