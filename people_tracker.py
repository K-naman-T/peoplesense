import cv2
import numpy as np
from ultralytics import YOLO

# Load a pre-trained YOLO model
model = YOLO('yolov8n.pt')

# Open video capture
cap = cv2.VideoCapture('test_video.mp4') # Or use 0 for webcam

# Define the line for counting
line_y = 300
counted_ids = set()
people_in = 0
people_out = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Perform object detection
    results = model.track(frame, persist=True, classes=[0]) # Class 0 is for 'person'

    # Draw the counting line
    cv2.line(frame, (0, line_y), (frame.shape[1], line_y), (0, 255, 0), 2)

    if results[0].boxes.id is not None:
        boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
        ids = results[0].boxes.id.cpu().numpy().astype(int)

        for box, id in zip(boxes, ids):
            x1, y1, x2, y2 = box
            # Draw bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
            cv2.putText(frame, f'ID: {id}', (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

            # Check if the center of the bounding box crosses the line
            cy = (y1 + y2) // 2
            if cy < line_y and id not in counted_ids:
                people_in += 1
                counted_ids.add(id)
            elif cy > line_y and id in counted_ids:
                people_out +=1
                counted_ids.remove(id)


    # Display the counts
    cv2.putText(frame, f'People In: {people_in}', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
    cv2.putText(frame, f'People Out: {people_out}', (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)


    # Show the frame
    cv2.imshow('People Tracking', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
