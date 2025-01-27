import supervision as sv
from ultralytics import YOLO
import torch
import numpy as np
import io
import os
import sys
import json
import base64
import cv2
import argparse
 
# Argument parser to take parameters from command line
parser = argparse.ArgumentParser(description="YOLO heatmap detection script")
parser.add_argument("--position", type=str, default="CENTER", choices=["CENTER", "CENTER_LEFT", "CENTER_RIGHT", "TOP_CENTER", "TOP_LEFT", "TOP_RIGHT", "BOTTOM_LEFT", "BOTTOM_CENTER", "BOTTOM_RIGHT", "CENTER_OF_MASS"],
                    help="Position for heatmap annotation")
parser.add_argument("--opacity", type=float, default=0.2, help="Opacity of the heatmap")
parser.add_argument("--radius", type=int, default=40, help="Radius for heatmap points")
parser.add_argument("--kernel_size", type=int, default=25, help="Kernel size for heatmap smoothing")
parser.add_argument("--top_hue", type=int, default=0, help="Top hue for the color map")
parser.add_argument("--low_hue", type=int, default=125, help="Low hue for the color map")
parser.add_argument("--classes", type=int, default=2, help="classes for detection")
 
args = parser.parse_args()
 
# Check if GPU is available and select device accordingly
device = 'cuda' if torch.cuda.is_available() else 'cpu'
 
# script_dir = os.path.dirname(os.path.abspath(__file__))
# model_path = os.path.join(script_dir, 'yolo11x.pt')

# Initialize YOLOv8 model and move it to GPU if available
model = YOLO('yolo11x.pt').to(device)
model.overrides['verbose'] = False  # Ensure the model runs on GPU
 
# Initialize heatmap annotator using command-line arguments
heat_map_annotator = sv.HeatMapAnnotator(
    position=sv.Position[args.position],  # Convert string to enum for position
    opacity=args.opacity,
    radius=args.radius,
    kernel_size=args.kernel_size,
    top_hue=args.top_hue,
    low_hue=args.low_hue
)
 
# Define the class index for "car"
CAR_CLASS_INDEX = args.classes # This is typically the index for "car" in YOLO models; confirm if needed.
 
def draw_heatmap(image_buffer):
    np_arr = np.frombuffer(image_buffer, np.uint8)   
    # Decode the image into a proper format (assuming the buffer is an encoded image)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    # Perform YOLO detection on the current frame and move data to GPU
    result = model(frame)[0].to(device)
    # Convert YOLOv8 results to Supervision Detections format
    detections = sv.Detections.from_ultralytics(result)
    # Filter detections to only include the "car" class
    car_detections = detections[detections.class_id == CAR_CLASS_INDEX]
    # Annotate frame with heatmap based on car detections
    annotated_frame = heat_map_annotator.annotate(
        scene=frame.copy(),  # Use a copy of the frame for annotations
        detections=car_detections
    )
 
     # Convert the annotated frame to a format that can be JSON serialized
    _, buffer = cv2.imencode('.jpg', annotated_frame)
    base64_image = base64.b64encode(buffer).decode('utf-8')
 
    return base64_image
 
while True:
    try:
        # Read base64 encoded image from stdin
        base64_image = sys.stdin.readline().strip()
        if not base64_image:
            break
 
        # Decode base64 to image buffer
        image_buffer = base64.b64decode(base64_image)
 
        # Process the input buffer and return the result
        result = draw_heatmap(image_buffer)
        # Open a file in write mode
        with open("outputNew.txt", "w") as file:
        # Write the output to the file
            file.write(result + '\n')
 
        # Send the result back to Node.js
        print(result + "\n")
        sys.stdout.flush()
 
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.stderr.flush()
        break
 
print("Python script exiting", file=sys.stderr)
sys.stderr.flush()