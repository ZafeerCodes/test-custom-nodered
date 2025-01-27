import sys
import base64
import cv2
import math
import numpy as np
from ultralytics import YOLO
import os

# Set up directories
script_dir = os.path.dirname(os.path.abspath(__file__))

# Initialize YOLO model
model_path = os.path.join(script_dir, '../models/yolov8s.pt')
model = YOLO(model_path)

classes_path = os.path.join(script_dir, 'classes.txt')
with open(classes_path, 'r') as f:
    classnames = f.read().splitlines()

def process_frame(frame):
    """Process single frame with object detection."""
    try:
        # Resize frame consistently
        frame = cv2.resize(frame, (640, 480), interpolation=cv2.INTER_AREA)

        # YOLO detection
        results = model(frame)

        for info in results:
            for box in info.boxes:
                # Extract detection parameters
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                confidence = math.ceil(box.conf[0] * 100)
                class_detect = classnames[int(box.cls[0])]

                # Detect persons and potential falls
                if confidence > 80 and class_detect == 'person':
                    # Draw person bounding box
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(
                        frame,
                        f'{class_detect} {confidence}%',
                        (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.5,
                        (0, 255, 0),
                        1
                    )

                    # Fall detection logic
                    height = y2 - y1
                    width = x2 - x1
                    if height - width < 0:
                        cv2.putText(
                            frame,
                            'Fall Detected',
                            (x1, y2 + 20),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            1,
                            (0, 0, 255),
                            2
                        )

        # Encode frame as JPEG
        success, buffer = cv2.imencode('.jpg', frame)
        if not success:
            raise ValueError("Frame encoding failed.")

        # Return base64 encoded frame
        return base64.b64encode(buffer).decode('utf-8')

    except Exception as e:
        raise ValueError(f"Error during frame processing: {str(e)}")

# Main processing loop
while True:
    try:
        input_data = sys.stdin.readline().strip()
        if not input_data:
            break

        # Decode and process frame
        frame_data = base64.b64decode(input_data)
        np_arr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError("Decoded frame is None. Ensure input is valid.")

        # Process frame and send it to stdout
        processed_frame = process_frame(frame)
        sys.stdout.write(processed_frame + "\n")
        sys.stdout.flush()

    except Exception as e:
        error_message = f"Error: {str(e)}"
        print(error_message, file=sys.stderr)
        sys.stderr.flush()
        break
