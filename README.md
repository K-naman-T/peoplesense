# People Tracking System

A comprehensive system for tracking people across multiple camera feeds using computer vision.

## Project Structure

```
/peopletracking/
├── app/                 # FastAPI backend
│   ├── camera_manager.py
│   ├── main.py
│   └── models.py
├── env/                 # Python virtual environment
├── frontend/            # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── ...
│   └── ...
├── main.py              # Direct script execution
├── people_tracker.py    # Core tracking functionality
├── requirements.txt     # Python dependencies
├── run.py               # Alternative entry point
└── v11.py               # Version 11 implementation
```

## Features

- Multiple camera tracking with a single interface
- Configurable counting lines for each camera
- Real-time statistics and visualizations
- Web-based dashboard for monitoring
- REST API for integration with other systems

## Backend (Python/FastAPI)

The backend consists of:

- YOLO model for object detection and tracking
- FastAPI web server for API endpoints
- Camera manager for handling multiple camera streams
- Statistics tracking and processing

### Requirements

- Python 3.9+
- OpenCV
- Ultralytics YOLOv8
- FastAPI
- Pydantic
- Other dependencies in requirements.txt

### Running the Backend

1. Activate the virtual environment:
   ```
   # On Windows
   .\env\Scripts\activate
   
   # On Linux/Mac
   source env/bin/activate
   ```

2. Install requirements (if not already installed):
   ```
   pip install -r requirements.txt
   ```

3. Run the FastAPI server:
   ```
   python -m app.main
   ```

4. The API will be available at http://localhost:8000

## Frontend (Next.js)

The frontend is built with:
- Next.js 14 with App Router
- React 18
- TypeScript
- Tailwind CSS
- Shadcn UI components

### Requirements

- Node.js 18+
- npm or yarn

### Running the Frontend

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the development server:
   ```
   npm run dev
   ```

4. The frontend will be available at http://localhost:3000

## Configuration

### Adding Cameras

1. From the frontend, go to "Cameras" > "Add Camera"
2. Enter camera details:
   - Name: A friendly name for the camera
   - Stream URL: 
     - For IP cameras: RTSP/HTTP URL (e.g., `rtsp://username:password@192.168.1.100:554/stream`)
     - For webcams: Use `0` for the default webcam, `1` for secondary webcam, etc.
     - For video files: Absolute path to the video file
3. Enable or disable the camera as needed
4. Click "Add Camera"

### Configuring Counting Lines

1. Go to the camera edit page
2. Select the "Counting Line" tab
3. Click two points on the image to draw a line
4. Click "Save Line"

## API Endpoints

- `GET /cameras/` - List all cameras
- `POST /cameras/` - Add a new camera
- `GET /cameras/{camera_id}` - Get camera details
- `DELETE /cameras/{camera_id}` - Remove a camera
- `POST /cameras/{camera_id}/line` - Set counting line
- `GET /stats/` - Get all statistics
- `GET /stats/{camera_id}` - Get statistics for a specific camera
- `GET /stream/{camera_id}` - Stream video from a camera

## Troubleshooting

### Camera Stream Issues

- Check that the camera URL is correct
- Verify network connectivity to IP cameras
- Ensure proper permissions for accessing webcams
- Check camera is enabled in the system

### Backend Server Issues

- Ensure Python environment is activated
- Check if all dependencies are installed
- Verify port 8000 is not in use by another application

### Frontend Issues

- Verify API URL is correctly set in .env.local
- Check browser console for JavaScript errors
- Ensure Node.js version is compatible
