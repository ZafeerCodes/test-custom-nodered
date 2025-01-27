import sys
import cv2
import base64
import numpy as np
from ultralytics import YOLO
import shapely.geometry as geom
import os
import argparse
import json

script_dir = os.path.dirname(os.path.abspath(__file__))

classes = ["dirty floor", "person", "smoke"]


def parse_arguments():
    parser = argparse.ArgumentParser(description='Object Detection Script')
    parser.add_argument('--modelPath', type=str, help='Path to the YOLO model')
    parser.add_argument('--objects', type=str, help='Comma-separated list of object class IDs')
    parser.add_argument('--threshold', type=float, default=0.25, help='Detection confidence threshold')
    parser.add_argument('--boundingBoxColor', type=str, default='#00ff00', help='Bounding box color in hex format')
    parser.add_argument('--fontSize', type=float, default=25, help='Font size for labels')
    parser.add_argument('--labelColor', type=str, default='#00ff00', help='Label color in hex format')
    parser.add_argument('--isTrackingEnabled', type=bool, default=False, help='Tracking of objects' )
    parser.add_argument('--labels', type=str, default=classes, help='Model Classes')
    return parser.parse_args()

object_detection_classes = parse_arguments().labels.split(',')


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))[::-1]  # Convert to BGR

def is_point_in_poly(point, poly):
    polygon = geom.Polygon(poly)
    return polygon.contains(geom.Point(point))

def is_point_in_rect(point, rect):
    x, y = point
    x1, y1 = rect[0]["x"], rect[0]["y"]
    x2, y2 = rect[1]["x"], rect[1]["y"]
    return x1 <= x <= x2 and y1 <= y <= y2

def is_point_in_circle(point, circle):
    x, y = point
    center_x, center_y = circle[0]["x"], circle[0]["y"]
    radius = circle[1]["radius"]
    return (x - center_x) ** 2 + (y - center_y) ** 2 <= radius ** 2

def draw_rois(frame, rois, args):
    """Draw ROIs on the frame with different colors and some transparency"""
    overlay = frame.copy()
    
    # Define different colors for different ROIs
    colors = {
        "rect": hex_to_rgb(args.boundingBoxColor),     
        "circle": hex_to_rgb(args.boundingBoxColor), 
        "poly": hex_to_rgb(args.boundingBoxColor)   
    }
    
    for roi in rois:
        roi_type = roi["type"]
        coords = roi["coords"]
        color = colors.get(roi_type, hex_to_rgb(args.labelColor))   
        
        if roi_type == "rect":
            pt1 = (int(coords[0]["x"]), int(coords[0]["y"]))
            pt2 = (int(coords[1]["x"]), int(coords[1]["y"]))
            cv2.rectangle(overlay, pt1, pt2, color, 2)
            
        elif roi_type == "circle":
            center = (int(coords[0]["x"]), int(coords[0]["y"]))
            radius = int(coords[1]["radius"])
            cv2.circle(overlay, center, radius, color, 2)
            
        elif roi_type == "poly":
            points = np.array([[int(point["x"]), int(point["y"])] for point in coords])
            cv2.polylines(overlay, [points], True, color, 2)
        
        # Add ROI name
        name_pos = (int(coords[0]["x"]), int(coords[0]["y"]) - 10)
        cv2.putText(overlay, roi["name"], name_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    
    # Apply semi-transparent overlay
    alpha = 0.3
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
    
    return frame

def filter_detections_by_rois(detections, rois):
    if not rois:
        return {"all": detections}

    roi_output = {}

    for roi in rois:
        roi_name = roi["name"]
        roi_type = roi["type"]
        coords = roi["coords"]

        roi_output[roi_name] = []

        for det in detections:
            x1, y1, x2, y2, *_ = det[:4]
            center = [(x1 + x2) / 2, (y1 + y2) / 2]

            if roi_type == "rect" and is_point_in_rect(center, coords):
                roi_output[roi_name].append(det)
            elif roi_type == "circle" and is_point_in_circle(center, coords):
                roi_output[roi_name].append(det)
            elif roi_type == "poly":
                poly_coords = [(point["x"], point["y"]) for point in coords]
                if is_point_in_poly(center, poly_coords):
                    roi_output[roi_name].append(det)

    return roi_output

def process_frame(frame, model, rois, args, tracker):
    target_classes = [int(cls) for cls in args.objects.split(',')] if args.objects else None

    results = model.predict(
        frame,
        conf=args.threshold,
        verbose=False,
    )

    if args.isTrackingEnabled and tracker:
        results = tracker(source=frame, persist=True)
    else:
        results = model(frame)

    detections = results[0]
    boxes = []
    confidences = []
    class_ids = []
    tracking_ids = []

    for det in detections.boxes.data.tolist():
        x1, y1, x2, y2, prob = det[:5]
        label = int(det[5]) if len(det) > 5 else -1
        tracking_id = det[6] if len(det) > 6 else None

        if args.isTrackingEnabled and tracker:
            x1, y1, x2, y2, prob = det[0], det[1], det[2], det[3], det[5]
            label = int(det[6])
            tracking_id = int(det[4])

        if target_classes is None or label in target_classes:
            boxes.append([x1, y1, x2 - x1, y2 - y1])  # Convert to (x, y, w, h) format
            confidences.append(prob)
            class_ids.append(label)
            tracking_ids.append(tracking_id)

    # Apply Non-Maximum Suppression
    indices = cv2.dnn.NMSBoxes(boxes, confidences, args.threshold, 0.4)

    final_boxes = []
    if len(indices) > 0:
        for i in indices.flatten():
            x1, y1, w, h = boxes[i]
            x2, y2 = x1 + w, y1 + h
            box_data = [x1, y1, x2, y2, object_detection_classes[class_ids[i]], confidences[i]]
            if args.isTrackingEnabled and tracker:
                box_data.append(tracking_ids[i])
            final_boxes.append(box_data)

    if rois:
        return filter_detections_by_rois(final_boxes, rois)
    else:
        return {"all": final_boxes}


def extract_boxes_and_labels(detections):
    bounding_boxes = {}
    labels = {}
    
    for roi_name, roi_detections in detections.items():
        bounding_boxes[roi_name] = []
        labels[roi_name] = []
        
        for det in roi_detections:
            x1, y1, x2, y2, label, prob, tracking_id = det[:7]
            bounding_boxes[roi_name].append({
                "x1": float(x1),
                "y1": float(y1),
                "x2": float(x2),
                "y2": float(y2),
                "label": str(label),
                "confidence": float(prob),
                "tracking_id": float(tracking_id)
            })
            labels[roi_name].append(str(label))
    
    return bounding_boxes, labels

def main(args):
    # Configure YOLO model to suppress outputs
    model = YOLO(args.modelPath)
    
    tracker = model.track if args.isTrackingEnabled else None
 
    # Disable console output for model loading
    import logging
    logging.getLogger("ultralytics").setLevel(logging.WARNING)

    # Convert colors from hex to BGR
    box_color = hex_to_rgb(args.boundingBoxColor)
    label_color = hex_to_rgb(args.labelColor)
    
    font_scale = args.fontSize / 50  

    while True:
        input_data = sys.stdin.readline().strip()
        if not input_data:
            break

        try:
            data = json.loads(input_data)
            frame_data = base64.b64decode(data['image'])
            rois = data.get('rois', None) 
            msg = data.get('msg', {}) 
            np_frame = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(np_frame, cv2.IMREAD_COLOR)

            result = process_frame(frame, model, rois, args, tracker)
            
            # Extract bounding boxes and labels
            bounding_boxes, labels = extract_boxes_and_labels(result)

            # Draw ROIs if present
            if rois:
                frame = draw_rois(frame, rois, args)

            for roi_name, detections in result.items():
                for det in detections:
                    x1, y1, x2, y2, label, confidence, *rest = det[:7]

                    tracking_id = rest[0] if len(rest) > 0 else None

                    cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), box_color, 2)

                    label_text = f"{label} [{confidence:.2f}]"
                    if roi_name != "all":
                        label_text = f"{roi_name}: {label_text}"
                    if tracking_id is not None:
                        label_text += f" (ID: {tracking_id})"

                    font_thickness = 2
                    text_x, text_y = int(x1), int(y1)
                    cv2.putText(frame, label_text, (text_x, text_y - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, font_scale, label_color, font_thickness)


            _, buffer = cv2.imencode('.jpg', frame)
            base64_image = base64.b64encode(buffer).decode('utf-8')
            
            # Prepare the output dictionary
            output = {
                "base64image": base64_image,
                "bounding_boxes": bounding_boxes,
                "labels": labels,
                "msg": msg
            }
            
            # Convert to JSON and print
            print(json.dumps(output))
            sys.stdout.flush()

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.stderr.flush()

if __name__ == "__main__":
    args = parse_arguments()
    
    main(args)