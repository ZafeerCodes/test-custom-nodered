import cv2
import torch
import torchvision.transforms as transforms
from PIL import Image
import os
import numpy as np
import io
import sys
import json
import base64
import argparse
from model import Face_Emotion_CNN
from retinaface import RetinaFace
 

parser = argparse.ArgumentParser(description='')
parser.add_argument('--name', type=str)
parser.add_argument('--boundingBoxColor', type=str)
parser.add_argument('--threshold', type=float)
parser.add_argument('--labelColor', type=str)
args = parser.parse_args()


# Convert hex color to RGB
def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

# Convert font color from hex to RGB
boundingBoxColor = hex_to_rgb(args.boundingBoxColor)
labelColor = hex_to_rgb(args.labelColor)

# Global variables for models and transformations
emotion_model = None
retinaface_det_model = None
val_transform = None

emotion_dict = {0: 'neutral', 1: 'happiness', 2: 'surprise', 3: 'sadness',
                4: 'anger', 5: 'disgust', 6: 'fear'}

def initialize_models():
    global emotion_model, retinaface_det_model, val_transform
    
    if emotion_model is None:
        emotion_model_path = os.path.join(os.path.dirname(__file__), 'FER_trained_model.pt')
        emotion_model = Face_Emotion_CNN()
        emotion_model.load_state_dict(torch.load(emotion_model_path, map_location=lambda storage, loc: storage, weights_only=True), strict=False)
        emotion_model.eval()
        
    if val_transform is None:
        val_transform = transforms.Compose([transforms.ToTensor()])

def FER_image(img, bboxes):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    annotated_img = img.copy()  # Create a copy of the image to annotate
    
    if bboxes is not None:
        for bbox in bboxes:
            x1, y1, x2, y2 = bbox[:4]
            
            # Ensure coordinates are within image boundaries
            x1 = int(max(0, x1))
            y1 = int(max(0, y1))
            x2 = int(min(img.shape[1], x2))
            y2 = int(min(img.shape[0], y2))
            
            # Check if the region is valid
            if x2 > x1 and y2 > y1:
                try:
                    roi = gray[y1:y2, x1:x2]
                    if roi.size > 0:
                        resize_frame = cv2.resize(roi, (48, 48))
                        X = val_transform(Image.fromarray(resize_frame)).unsqueeze(0)
                        with torch.no_grad():
                            log_ps = emotion_model(X)
                            ps = torch.exp(log_ps)
                            top_p, top_class = ps.topk(1, dim=1)
                            if top_p.item() < args.threshold:
                                pred = 'neutral'
                            else:
                                pred = emotion_dict[int(top_class.numpy()[0][0])]
                            
                            # Draw both rectangle and text
                            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), boundingBoxColor, 2)
                            cv2.putText(annotated_img, pred, (x1, y1 - 10),
                                      cv2.FONT_HERSHEY_SIMPLEX, 0.9, labelColor , 2)
                            
                except Exception as e:
                    print(f"Error processing ROI: {str(e)}", file=sys.stderr)
                    sys.stderr.flush()
            else:
                print(f"Invalid bounding box: {bbox}", file=sys.stderr)
                sys.stderr.flush()
    
    return annotated_img

def annotate_and_return_buffer(image_buffer, coordinates):
    # Decode the input image
    frame = cv2.imdecode(np.frombuffer(image_buffer, np.uint8), cv2.IMREAD_COLOR)
    
    # Get predictions and annotated image
    annotated_frame = FER_image(frame, coordinates)
    
    # Encode the annotated image back to buffer
    _, buffer = cv2.imencode('.jpg', annotated_frame)
    return buffer.tobytes()

if __name__ == "__main__":
    initialize_models()
    
    while True:
        try:
            # Read JSON data from stdin
            json_data = sys.stdin.readline().strip()
            if not json_data:
                break
            
            # Parse the JSON data
            data = json.loads(json_data)
            
            # Extract the image buffer and coordinates array
            image_buffer = base64.b64decode(data['image'])
            coordinates = data['coordinates']
            
            # Process the input and return the result
            result_buffer = annotate_and_return_buffer(image_buffer, coordinates)
            base64_image = base64.b64encode(result_buffer).decode('utf-8')

            # Send the result back to Node.js
            print(json.dumps(base64_image))
            sys.stdout.flush()
            
        except Exception as e:
            print(f"Error: {str(e)}", file=sys.stderr)
            sys.stderr.flush()
            break

    print("Python script exiting", file=sys.stderr)
    sys.stderr.flush()