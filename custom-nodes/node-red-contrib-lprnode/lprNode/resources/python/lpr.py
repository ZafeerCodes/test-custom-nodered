
import cv2
import torch
from ultralytics import YOLO
from paddleocr import PaddleOCR
import numpy as np
import base64
import sys
import json
import argparse
import os

script_dir = os.path.dirname(os.path.abspath(__file__))

parser = argparse.ArgumentParser(description="LPR Script")
parser.add_argument("--boundingBoxColor", type=str, default="#00FF00", help="Bounding box color for vehicles")
parser.add_argument("--labelColor", type=str, default="#00FF00", help="Label color")
parser.add_argument("--fontSize", type=int, default=2, help="Font size")

args = parser.parse_args()

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return rgb[::-1]

def px_to_scale(px_size, base_size=16):
    return px_size / base_size

bounding_box_color = hex_to_rgb(args.boundingBoxColor)
label_color = hex_to_rgb(args.labelColor)
font_scale = px_to_scale(args.fontSize)


model_path = os.path.join(script_dir, 'plate_recognizer.pt')
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = YOLO(model_path)
model.eval()

# Load PaddleOCR models for English
ocr_en = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

def detect_plate_with_model(frame, model):
    results = model(frame)
    
    if isinstance(results, list):
        results = results[0]
    
    plates = []
    for box in results.boxes.xyxy:
        x1, y1, x2, y2 = map(int, box)
        plate = frame[y1:y2, x1:x2]
        plates.append(((x1, y1), (x2, y2), plate))
    
    return plates

def read_plate(plate, ocr_en):
    result = ''
    plate_text_en = ocr_en.ocr(plate, cls=False, det=True)
    if plate_text_en and plate_text_en[0]:
        for entry in plate_text_en[0]:
            if len(entry) > 1 and isinstance(entry[1], tuple) and len(entry[1]) > 0:
                detected_text = entry[1][0]
                result += f" {detected_text}"
        result = result.strip()
        return result
    return None

def draw_bounding_box_and_label(image, top_left, bottom_right, text):
    font = cv2.FONT_HERSHEY_SIMPLEX
    thickness = 2

    # Draw the bounding box
    cv2.rectangle(image, top_left, bottom_right, bounding_box_color, 2)

    # Add text label without background
    text_size = cv2.getTextSize(text, font, font_scale, thickness)[0]
    text_x = top_left[0]
    text_y = max(top_left[1] - 10, text_size[1] + 10)  # Adjust text position above the box
    cv2.putText(image, text, (text_x, text_y), font, font_scale, label_color, thickness)

    return image

def main():
    while True:
        try:
            input_data = sys.stdin.readline().strip()
            if not input_data:
                break

            frame_data = base64.b64decode(input_data)
            np_arr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                raise ValueError("Decoded frame is None. Ensure input is valid.")

            detected_plates = detect_plate_with_model(frame, model)
            plate_texts = []

            for top_left, bottom_right, plate in detected_plates:
                plate_text = read_plate(plate, ocr_en)
                if plate_text:
                    plate_texts.append(plate_text)
                    frame = draw_bounding_box_and_label(frame, top_left, bottom_right, plate_text)

            # Encode the processed frame
            _, buffer = cv2.imencode('.jpg', frame)
            encoded_frame = base64.b64encode(buffer).decode('utf-8')

            # Encode the plate texts
            plates_json = json.dumps({"plates": plate_texts})
            encoded_plates = base64.b64encode(plates_json.encode('utf-8')).decode('utf-8')

            # Output the frame and plate texts
            sys.stdout.write(encoded_frame + "@" + encoded_plates + "\n")
            sys.stdout.flush()

        except Exception as e:
            error_message = f"Error: {str(e)}"
            print(error_message, file=sys.stderr)
            sys.stderr.flush()
            break

if __name__ == "__main__":
    main()