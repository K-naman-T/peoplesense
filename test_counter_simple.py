import cv2
import numpy as np
import sys
from ultralytics import YOLO

# Check for command line argument for video file
if len(sys.argv) > 1:
    VIDEO_SOURCE = sys.argv[1]
    print(f"Using video file: {VIDEO_SOURCE}")
else:
    # Default to test_video.mp4 if available, otherwise try webcam
    import os
    if os.path.exists('test_video.mp4'):
        VIDEO_SOURCE = 'test_video.mp4'
        print("Using test_video.mp4")
    else:
        VIDEO_SOURCE = 0
        print("Using webcam")

# Load the YOLO model
model = YOLO('yolov8n.pt')

# Open video capture
cap = cv2.VideoCapture(VIDEO_SOURCE)
if not cap.isOpened():
    print(f"Error: Could not open video source {VIDEO_SOURCE}")
    sys.exit()

# Get video dimensions
ret, frame = cap.read()
if not ret:
    print("Error: Couldn't read frame from video source")
    sys.exit()
frame_height, frame_width = frame.shape[:2]

# Define the line position (horizontal line in the middle by default)
line_y = frame_height // 2

# Initialize counters
counted_ids = set()
people_in = 0
people_out = 0

print("Starting video processing...")
print(f"Counting line set at y={line_y}")

# Reset to the start of the video
if VIDEO_SOURCE != 0:
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

while True:
    ret, frame = cap.read()
    if not ret:
        print("End of video")
        # If it's a video file, loop it
        if VIDEO_SOURCE != 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        break

    # Perform object detection and tracking
    results = model.track(frame, persist=True, classes=[0])  # Class 0 is person

    # Draw the counting line (more visible)
    cv2.line(frame, (0, line_y), (frame_width, line_y), (255, 255, 255), 4)  # White border
    cv2.line(frame, (0, line_y), (frame_width, line_y), (0, 0, 255), 2)      # Red line

    # Process people detection if there are any tracked objects
    if results[0].boxes.id is not None:
        boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
        ids = results[0].boxes.id.cpu().numpy().astype(int)

        for box, obj_id in zip(boxes, ids):
            x1, y1, x2, y2 = box
            str_id = str(obj_id)
            
            # Calculate center of the bounding box
            center_x = (x1 + x2) // 2
            center_y = (y1 + y2) // 2
            
            # Draw bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, f"ID: {str_id}", (x1, y1 - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            
            # Draw center point
            cv2.circle(frame, (center_x, center_y), 5, (0, 0, 255), -1)
            
            # Check if the person crosses the line
            # Person is considered "in" when moving from bottom to top
            if center_y < line_y and str_id not in counted_ids:
                people_in += 1
                counted_ids.add(str_id)
                print(f"Person {str_id} entered (crossed from bottom to top)")
                # Draw a green arrow showing the crossing
                cv2.arrowedLine(frame, (center_x, center_y+20), (center_x, center_y-20), 
                               (0, 255, 0), 4)
                
            # Person is considered "out" when moving from top to bottom
            elif center_y > line_y and str_id in counted_ids:
                people_out += 1
                counted_ids.remove(str_id)
                print(f"Person {str_id} exited (crossed from top to bottom)")
                # Draw a red arrow showing the crossing
                cv2.arrowedLine(frame, (center_x, center_y-20), (center_x, center_y+20), 
                               (0, 0, 255), 4)

    # Add stats overlay to frame
    cv2.rectangle(frame, (10, 10), (200, 90), (0, 0, 0), -1)  # Black background
    cv2.putText(frame, f"IN:  {people_in}", (20, 40), 
              cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    cv2.putText(frame, f"OUT: {people_out}", (20, 80), 
              cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    
    # Show the frame
    cv2.imshow('Line Counting Test', frame)
    
    # Break on 'q' key
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Clean up
cap.release()
cv2.destroyAllWindows()

print("\nFinal counts:")
print(f"People IN:  {people_in}")
print(f"People OUT: {people_out}")