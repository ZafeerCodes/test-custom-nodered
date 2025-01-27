import torch
import numpy as np
from PIL import Image
import torchvision.transforms as transforms
from facenet_pytorch import MTCNN, InceptionResnetV1
from retinaface import RetinaFace
from qdrant_client import QdrantClient
from qdrant_client.http import models
import cv2
from typing import List, Tuple
from ultralytics import YOLO
from datetime import datetime
import sys
import base64
import traceback
import argparse
import os

parser = argparse.ArgumentParser(description='')
parser.add_argument('--dataSet', type=str)
parser.add_argument('--detectionThreshold', type=float)
parser.add_argument('--recognitionThreshold', type=float)
args = parser.parse_args()

script_dir = os.path.dirname(os.path.abspath(__file__))
 
class FaceDetector:
    """Base class for face detection models"""
    def __init__(self):
        self.model = None
    def detect_faces(self, image) -> List[Tuple[int, int, int, int]]:
        raise NotImplementedError
 
class YOLOv8FaceDetector(FaceDetector):
    def __init__(self, model_path: str = None):
        super().__init__()
        if model_path:
            self.model = YOLO(model_path)
        else:
            self.model = YOLO(os.path.join(script_dir, './models/yolov8n-face.pt'), task='detect')
    def detect_faces(self, image) -> List[Tuple[int, int, int, int]]:
        results = self.model(image, conf=args.detectionThreshold  , verbose = False)
        boxes = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                boxes.append((x1, y1, x2, y2))
        return boxes
 
class MTCNNDetector(FaceDetector):
    def __init__(self):
        super().__init__()
        self.model = MTCNN(keep_all=True)
    def detect_faces(self, image) -> List[Tuple[int, int, int, int]]:
        if isinstance(image, np.ndarray):
            image = Image.fromarray(image)
        boxes, _ = self.model.detect(image)
        if boxes is None:
            return []
        return [tuple(map(int, box)) for box in boxes]
 
class FaceNetEmbedding:
    def __init__(self):
        self.model = InceptionResnetV1(pretrained='vggface2').eval()
        self.transform = transforms.Compose([
            transforms.Resize((160, 160)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
        ])
    def generate_embedding(self, face_image) -> np.ndarray:
        if isinstance(face_image, np.ndarray):
            face_image = Image.fromarray(face_image)
        face_tensor = self.transform(face_image).unsqueeze(0)
        with torch.no_grad():
            embedding = self.model(face_tensor)
        return embedding.numpy().flatten()
 
class FaceRecognitionSystem:
    def __init__(self, detector_name: str, embedding_model_name: str, yolo_model_path: str = None):
        self.detector = self._get_detector(detector_name, yolo_model_path)
        self.embedding_model = FaceNetEmbedding()
        self.qdrant_client = QdrantClient("192.168.0.95", port=30005)
        self.result = []
 
    def _get_detector(self, name: str, yolo_model_path: str = None) -> FaceDetector:
        detectors = {
            'yolov8': lambda: YOLOv8FaceDetector(yolo_model_path),
            'mtcnn': MTCNNDetector
        }
        return detectors[name.lower()]()
 
    def process_frame(self, frame: np.ndarray, collection_name: str, score_threshold: float = 0.5):
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        boxes = []
        names = []
        scores = []
        face_boxes = self.detector.detect_faces(rgb_frame)
        for box in face_boxes:
            x1, y1, x2, y2 = box
            face = rgb_frame[y1:y2, x1:x2]
            embedding = self.embedding_model.generate_embedding(face)
            name, score = self.recognize_face(embedding, collection_name, score_threshold)
            names.append(f"{name}".split("-")[-1].split(".")[0])
            scores.append(score)
            boxes.append(box)
            self.draw_label(frame, box, name, score)
        self.result=[frame, boxes ,names, scores]
        return self.result
 
    def recognize_face(self, embedding: np.ndarray, collection_name: str, score_threshold: float) -> Tuple[str, float]:
        results = self.qdrant_client.search(
            collection_name=collection_name,
            query_vector=embedding.tolist(),
            limit=1
        )
        if results:
            best_match = results[0]
            score = best_match.score
            name = best_match.payload.get('filename', 'Unknown') if score > score_threshold else "Unknown"
            return name, score
        return "Unknown", 0.0
 
    def draw_label(self, frame: np.ndarray, box: Tuple[int, int, int, int], name: str, score: float):
        x1, y1, x2, y2 = box
        nameOfPerson = f"{name}".split("-")[-1].split(".")[0]
        label = f"{nameOfPerson} ({score:.2f})"
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, label , (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
 
# Testing the video recognition system
if __name__ == "__main__":

    system = FaceRecognitionSystem(detector_name='yolov8', embedding_model_name='facenet')
    frame_ct = 0
    while True:
        try:
            # Read base64 encoded image from stdin
            base64_image = sys.stdin.readline().strip()
            if not base64_image:
                break
    
            # Decode base64 to image buffer
            frame = base64.b64decode(base64_image)
            # Convert bytes to a NumPy array and decode it into an image
            np_arr = np.frombuffer(frame, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            # Process the input buffer and return the result
            result = system.process_frame(frame=frame, collection_name= args.dataSet.strip().lower().replace(" ","") , score_threshold = 0.5)
            # result = system.process_frame(frame=frame, collection_name='mwfaces' , score_threshold = args.recognitionThreshold)
            annotated_image = result[0]
            boxes = result[1]
            labels = result[2]
            scores = result[3]

            frame_ct += 1

            _, buffer = cv2.imencode('.jpg', annotated_image)
            base64_image = base64.b64encode(buffer).decode('utf-8')

            print(f'{base64_image} @ {labels}')

            sys.stdout.flush()
    
        except Exception as e:
            # Print full traceback to stderr
            traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
 
print("Python script exiting", file=sys.stderr)
sys.stderr.flush()
