

import sys
import base64
import cv2
import numpy as np
from collections import defaultdict
from ultralytics import YOLO
import supervision as sv
import argparse
import json

parser = argparse.ArgumentParser(description="Object Counting Script")
parser.add_argument("--lines", type=str, default="", help="Lines Data")
parser.add_argument("--boundingBoxColor", type=str, default="#00FF00", help="Bounding box color")
parser.add_argument("--labelColor", type=str, default="#00FF00", help="Label color")
parser.add_argument("--lineColor", type=str, default="#00FF00", help="Line color")
parser.add_argument("--fontSize",  type=int, default=2, help="Font size")
parser.add_argument("--classes", type=str, default="", help="Lines Data")


args = parser.parse_args()

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return rgb[::-1]

# Function to convert font size in pixels to OpenCV scale factor
def px_to_scale(px_size, base_size=16):
    return px_size / base_size

bounding_box_color = hex_to_rgb(args.boundingBoxColor)
label_color = hex_to_rgb(args.labelColor)
line_color = hex_to_rgb(args.lineColor)
font_scale = px_to_scale(args.fontSize)
lines_data = args.lines
classes = json.loads(args.classes)

print(classes, "param classes")

class LineCrossingDetector:
    def __init__(self, lines, line_names=None):
        """
        Initialize detector with multiple lines
        Args:
            lines: List of tuples, each containing ((x1,y1), (x2,y2)) coordinates for a line
            line_names: Optional list of names for each line
        """
        self.lines = lines
        self.line_names = line_names or [f"Line {i+1}" for i in range(len(lines))]
        self.counts_data = {
            name: {
                'in': {'count': 0, 'ids': set()},
                'out': {'count': 0, 'ids': set()},
                'coordinates': lines[i]
            } for i, name in enumerate(self.line_names)
        }
        self.previous_positions = {}

    def _get_line_equation(self, line):
        """Calculate line equation parameters (ax + by + c = 0)"""
        (x1, y1), (x2, y2) = line
        a = y2 - y1
        b = x1 - x2
        c = x2 * y1 - x1 * y2
        return a, b, c

    def _calculate_side(self, point, line):
        """Determine which side of the line a point is on"""
        a, b, c = self._get_line_equation(line)
        x, y = point
        return np.sign(a * x + b * y + c)

    def _check_crossing(self, current_pos, previous_pos, line):
        """Check if an object crossed the line between previous and current position"""
        if previous_pos is None:
            return None
        current_side = self._calculate_side(current_pos, line)
        previous_side = self._calculate_side(previous_pos, line)
        if current_side != previous_side:
            (x1, y1), (x2, y2) = line
            line_vector = np.array([x2 - x1, y2 - y1])
            movement_vector = np.array([current_pos[0] - previous_pos[0], current_pos[1] - previous_pos[1]])
            cross_product = np.cross(line_vector, movement_vector)
            return 'in' if cross_product > 0 else 'out'
        return None

    def update(self, detections):
        """Update crossing detection with new frame detections"""
        current_objects = {}
        for obj_id, x, y in detections:
            current_pos = (x, y)
            current_objects[obj_id] = current_pos
            for line_name in self.line_names:
                line = self.counts_data[line_name]['coordinates']
                previous_pos = self.previous_positions.get(obj_id)
                crossing = self._check_crossing(current_pos, previous_pos, line)
                if crossing:
                    self.counts_data[line_name][crossing]['count'] += 1
                    self.counts_data[line_name][crossing]['ids'].add(obj_id)
        self.previous_positions = current_objects

    def get_counts(self):
        """Return detailed counting data"""
        return self.counts_data

    # Modify this function to return counts according to arrow
    # def get_summary(self, arrows):
    #     """Return a formatted summary of all counts"""
    #     summary = {}
    #     for line_name, data in self.counts_data.items():
    #         summary[line_name] = {
    #             'in': data['in']['count'],
    #             'out': data['out']['count'],
    #             'total_unique': len(data['in']['ids'].union(data['out']['ids']))
    #         }
    #     return summary

    def get_summary(self, arrows):
        """Return a formatted summary of all counts based on arrows"""
        summary = {}
        for line_name, data in self.counts_data.items():
            arrow_data = arrows.get(line_name, {})
            line_summary = {
                "in": 0,
                "out": 0,
                "total_unique": 0
            }

            if arrow_data.get('upArrow'):
                line_summary['in'] = data['in']['count']
            if arrow_data.get('downArrow'):
                line_summary['out'] = data['out']['count']
            
            # Include total_unique only if both arrows are present or required
            if arrow_data.get('upArrow') or arrow_data.get('downArrow'):
                line_summary['total_unique'] = len(data['in']['ids'].union(data['out']['ids']))

            summary[line_name] = line_summary
        
        return summary

def get_bottom_center(box):
    """Calculate bottom center point from bounding box"""
    x1, y1, x2, y2 = map(int, box[:4])
    bottom_center_x = (x1 + x2) // 2
    bottom_center_y = y2
    return bottom_center_x, bottom_center_y

def process_frames(lines, line_names=None, arrows=[], conf=0.3, iou=0.7):
    """
    Process frames and count line crossings using YOLOv8
    Args:
        lines: List of line coordinates
        line_names: Optional list of names for each line
        conf: Confidence threshold for YOLO detection
        iou: IOU threshold for YOLO detection
    """
    model = YOLO('yolov8n.pt')
    detector = LineCrossingDetector(lines, line_names)

    while True:
        input_data = sys.stdin.readline().strip()
        if not input_data:
            break

        try:
            frame_data = base64.b64decode(input_data)
            np_array = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(np_array, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"Error decoding frame: {e}", file=sys.stderr)
            continue

        results = model.track(frame, conf=conf, iou=iou, persist=True)

        # if results[0].boxes.id is not None:
        #     boxes = results[0].boxes
        #     detections = []
        #     for box, track_id in zip(boxes.xyxy, boxes.id):
        #         bottom_center_x, bottom_center_y = get_bottom_center(box)
        #         track_id = int(track_id.item())
        #         detections.append((track_id, bottom_center_x, bottom_center_y))
        #     detector.update(detections)

        if results[0].boxes.id is not None:
            boxes = results[0].boxes
            detections = []
            for box, track_id, class_id in zip(boxes.xyxy, boxes.id, boxes.cls):
                if int(class_id.item()) in classes:  # Check if class ID is in allowed_classes list
                    bottom_center_x, bottom_center_y = get_bottom_center(box)
                    track_id = int(track_id.item())
                    detections.append((track_id, bottom_center_x, bottom_center_y))
            detector.update(detections)

        annotated_frame = frame.copy()
        # if results[0].boxes.id is not None:
        #     for box, track_id in zip(boxes.xyxy, boxes.id):
        #         x1, y1, x2, y2 = map(int, box[:4])
        #         track_id = int(track_id.item())
        #         bottom_center_x, bottom_center_y = get_bottom_center(box)
        #         cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), bounding_box_color, 2)
        #         cv2.circle(annotated_frame, (bottom_center_x, bottom_center_y), 4, (255, 0, 0), -1)
        #         cv2.putText(annotated_frame, f"ID: {track_id}", (x1, y1 - 10),
        #                     cv2.FONT_HERSHEY_SIMPLEX, font_scale, label_color, 2)

        if results[0].boxes.id is not None:
            for box, track_id, class_id in zip(boxes.xyxy, boxes.id, boxes.cls):
                if int(class_id.item()) in classes:  # Check if class ID is in allowed_classes list
                    x1, y1, x2, y2 = map(int, box[:4])
                    track_id = int(track_id.item())
                    bottom_center_x, bottom_center_y = get_bottom_center(box)

                    # Draw the bounding box
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), bounding_box_color, 2)
                    
                    # Draw the bottom center point
                    cv2.circle(annotated_frame, (bottom_center_x, bottom_center_y), 4, (255, 0, 0), -1)
                    
                    # Add the track ID text
                    cv2.putText(annotated_frame, f"ID: {track_id}", (x1, y1 - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, font_scale, label_color, 2)

        summary = detector.get_summary(arrows)
        # for i, (line_name, data) in enumerate(summary.items()):
        #     line = detector.counts_data[line_name]['coordinates']
        #     cv2.line(annotated_frame,
        #              tuple(map(int, line[0])),
        #              tuple(map(int, line[1])),
        #              line_color, 2)
        #     base_y = 30 + i * 90
        #     cv2.putText(annotated_frame, f"{line_name}:",
        #                 (10, base_y),
        #                 cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 255), 2)
        #     cv2.putText(annotated_frame, f"In: {data['in']}",
        #                 (10, base_y + 25),
        #                 cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 0), 2)
        #     cv2.putText(annotated_frame, f"Out: {data['out']}",
        #                 (10, base_y + 50),
        #                 cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 0), 2)
        #     total_text = f"Total: {data['total_unique']}"
        #     text_size = cv2.getTextSize(total_text, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
        #     cv2.putText(annotated_frame, total_text,
        #                 (frame.shape[1] - text_size[0] - 10, base_y + 25),
        #                 cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 165, 0), 2)
        line_spacing = 10
        for i, (line_name, data) in enumerate(summary.items()):
            line = detector.counts_data[line_name]['coordinates']
            cv2.line(annotated_frame,
                    tuple(map(int, line[0])),
                    tuple(map(int, line[1])),
                    line_color, 2)

            # Dynamically calculate spacing
            text_height = cv2.getTextSize("Sample Text", cv2.FONT_HERSHEY_SIMPLEX, font_scale, 2)[0][1]
            base_y = 30 + i * (3 * text_height + 3 * line_spacing)  # Adjust spacing dynamically

            # Draw line name
            cv2.putText(annotated_frame, f"{line_name}:",
                        (10, base_y),
                        cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 255), 2)

            # Draw 'In' count
            cv2.putText(annotated_frame, f"In: {data['in']}",
                        (10, base_y + text_height + line_spacing),
                        cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 0), 2)

            # Draw 'Out' count
            cv2.putText(annotated_frame, f"Out: {data['out']}",
                        (10, base_y + 2 * (text_height + line_spacing)),
                        cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 0), 2)

            # Draw 'Total' count
            total_text = f"Total: {data['total_unique']}"
            text_size = cv2.getTextSize(total_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 2)[0]
            cv2.putText(annotated_frame, total_text,
                        (frame.shape[1] - text_size[0] - 10, base_y + text_height + line_spacing),
                        cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 165, 0), 2)

        # cv2.imshow('Frame', annotated_frame)
        # if cv2.waitKey(1) & 0xFF == ord('q'):
        #     break

        _, buffer = cv2.imencode('.jpg', annotated_frame)
        encoded_frame = base64.b64encode(buffer).decode('utf-8')

        results_json = json.dumps({"results": summary})
        encoded_results = base64.b64encode(results_json.encode('utf-8')).decode('utf-8')

        print(encoded_frame + "@"+ encoded_results + "\n")

    # cv2.destroyAllWindows()
    return detector.get_counts()

# Example usage
if __name__ == "__main__":
    lines = [
        ((242, 243), (728, 231)),
        ((152, 410), (831, 375))  # vertical line
    ]
    # line_names = ["South Entrance", "TEST Line"]
    # print(json.dumps(lines_data), "Lines Data")

    loaded_data = json.loads(lines_data)

    transformed_coords = [
        ((line['coords'][0]['x'], line['coords'][0]['y']),
        (line['coords'][1]['x'], line['coords'][1]['y']))
        for line in loaded_data
    ]

    line_names = [line['name'] for line in loaded_data]
    arrows = {line['name']: {'upArrow': line['upArrow'], 'downArrow': line['downArrow']} for line in loaded_data}

    counts = process_frames(transformed_coords, line_names, arrows)
    print("\nFinal Counts:")
    for line_name, data in counts.items():
        print(f"\n{line_name}:")
        print(f"  In: {data['in']['count']} (IDs: {data['in']['ids']})")
        print(f"  Out: {data['out']['count']} (IDs: {data['out']['ids']})")
        total_unique = len(data['in']['ids'].union(data['out']['ids']))
        print(f"  Total Unique Objects: {total_unique}")
