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

# Import your model and RetinaFace here
from model import Face_Emotion_CNN
from retinaface import RetinaFace

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
    
    if retinaface_det_model is None:
        PROVIDERS = ['CPUExecutionProvider']
        retinaface_face_detection_path = os.path.join(os.path.dirname(__file__), 'det_10g.onnx')
        retinaface_det_model = RetinaFace(retinaface_face_detection_path, providers=PROVIDERS)
        retinaface_det_model.prepare(ctx_id=1, input_size=(640, 640), det_thresh=0.7)
    
    if val_transform is None:
        val_transform = transforms.Compose([transforms.ToTensor()])

def FER_image(img, bboxes):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    predictions = []
    
    if bboxes is not None:
        for bbox in bboxes:
            x1, y1, x2, y2 = bbox[:4].astype(int)
            
            # Ensure coordinates are within image boundaries
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(img.shape[1], x2)
            y2 = min(img.shape[0], y2)
            
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
                            if top_p < 0.7:
                                pred = 'neutral'
                            else:
                                pred = emotion_dict[int(top_class.numpy()[0][0])]
                            predictions.append([int(x1), int(y1), int(x2), int(y2), pred])
                except Exception as e:
                    print(f"Error processing ROI: {str(e)}", file=sys.stderr)
                    sys.stderr.flush()
            else:
                print(f"Invalid bounding box: {bbox}", file=sys.stderr)
                sys.stderr.flush()
    
    return predictions

def annotate_and_return_buffer(image_buffer):
    frame = cv2.imdecode(np.frombuffer(image_buffer, np.uint8), cv2.IMREAD_COLOR)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    bboxes, kpss = retinaface_det_model.detect(rgb_frame, max_num=0, metric='default')

    # //get this from Object detectiomn - frame, bboxes
    predictions = FER_image(frame, bboxes)
    return predictions

if __name__ == "__main__":
    initialize_models()
    
    while True:
        try:
            # Read base64 encoded image from stdin
            base64_image = sys.stdin.readline().strip()
            if not base64_image:
                break

            # Decode base64 to image buffer
            image_buffer = base64.b64decode(base64_image)

            # Process the input buffer and return the result
            result = annotate_and_return_buffer(image_buffer)
            
            # Send the result back to Node.js
            print(json.dumps(result))
            sys.stdout.flush()
        
        except Exception as e:
            print(f"Error: {str(e)}", file=sys.stderr)
            sys.stderr.flush()
            break

    print("Python script exiting", file=sys.stderr)
    sys.stderr.flush()