import numpy as np
import cv2
from typing import List, Tuple
from ultralytics import YOLO
from facenet_pytorch import MTCNN
from retinaface import RetinaFace
from PIL import Image
import base64
import sys
import traceback
import json
from dataclasses import dataclass
import argparse
import os

# Add argument parser
parser = argparse.ArgumentParser()
parser.add_argument('--model', type=str, default='yolo')
parser.add_argument('--boundingBoxColor', type=str, default='#00FF00')
parser.add_argument('--threshold', type=float, default=0.5)
args = parser.parse_args()

script_dir = os.path.dirname(os.path.abspath(__file__))

@dataclass
class DetectionResult:
    annotated_image: np.ndarray
    boxes: List[Tuple[int, int, int, int]]

class BaseFaceDetector:
    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        raise NotImplementedError

class YOLOv8Detector(BaseFaceDetector):
    def __init__(self, threshold):
        self.model = YOLO(os.path.join(script_dir, './models/yolov8n-face.pt'), task='detect')
        self.threshold = threshold

    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        results = self.model(image, conf=self.threshold, verbose=False)
        boxes = []
        for result in results:
            for box in result.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                boxes.append((x1, y1, x2, y2))
        return boxes

class MTCNNDetector(BaseFaceDetector):
    def __init__(self, threshold):
        self.model = MTCNN(keep_all=True, min_face_size=20, thresholds=[threshold, threshold+0.1, threshold+0.2])

    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        if isinstance(image, np.ndarray):
            image = Image.fromarray(image)
        boxes, _ = self.model.detect(image)
        if boxes is None:
            return []
        return [tuple(map(int, box)) for box in boxes]

class RetinaFaceDetector(BaseFaceDetector):
    def __init__(self, threshold):
        self.model = RetinaFace()
        self.threshold = threshold

    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        faces = self.model.detect_faces(image)
        if isinstance(faces, tuple):
            return []
            
        boxes = []
        for face_data in faces.values():
            if face_data.get("score", 1.0) >= self.threshold:
                box = face_data["facial_area"]
                boxes.append(tuple(map(int, box)))
        return boxes

class FaceDetector:
    def __init__(self, model_type: str, threshold: float, box_color: str):
        # Convert hex color to BGR
        hex_color = box_color.lstrip('#')
        rgb_color = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        self.box_color = rgb_color[::-1]  # Convert RGB to BGR
        
        # Initialize selected model
        if model_type.lower() == 'yolo':
            self.model = YOLOv8Detector(threshold)
        elif model_type.lower() == 'mtcnn':
            self.model = MTCNNDetector(threshold)
        elif model_type.lower() == 'retinaface':
            self.model = RetinaFaceDetector(threshold)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

    def draw_boxes(self, image: np.ndarray, boxes: List[Tuple[int, int, int, int]]):
        for box in boxes:
            x1, y1, x2, y2 = box
            cv2.rectangle(image, (x1, y1), (x2, y2), self.box_color, 2)

    def process_frame(self, frame: np.ndarray) -> DetectionResult:
        boxes = self.model.detect_faces(frame)
        self.draw_boxes(frame, boxes)
        return DetectionResult(
            annotated_image=frame,
            boxes=boxes
        )

class FaceDetectionService:
    def __init__(self, model_type: str, threshold: float, box_color: str):
        self.detector = FaceDetector(model_type, threshold, box_color)
        
    def process_base64_frame(self, base64_image: str) -> Tuple[str, List[Tuple[int, int, int, int]]]:
        frame_data = base64.b64decode(base64_image)
        np_arr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        result = self.detector.process_frame(frame)
        
        _, buffer = cv2.imencode('.jpg', result.annotated_image)
        output_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return output_base64, result.boxes

    def run_detection_loop(self):
        while True:
            try:
                base64_image = sys.stdin.readline().strip()
                if not base64_image:
                    break
                
                output_base64, boxes = self.process_base64_frame(base64_image)
                print(f'{output_base64} @ {boxes}')
                sys.stdout.flush()
                
            except Exception as e:
                traceback.print_exc(file=sys.stderr)
                sys.stderr.flush()
        
        print("Detection loop completed", file=sys.stderr)
        sys.stderr.flush()

if __name__ == "__main__":
    service = FaceDetectionService(
        model_type=args.model,
        threshold=args.threshold,
        box_color=args.boundingBoxColor
    )
    service.run_detection_loop()