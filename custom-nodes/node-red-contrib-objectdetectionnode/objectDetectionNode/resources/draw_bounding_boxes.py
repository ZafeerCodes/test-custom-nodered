import cv2
import sys
import base64
import numpy as np
import json

def draw_bounding_box(frame, bbox, label, color=(0, 255, 0), thickness=2):
    """
    Draws a bounding box with a label on the given frame.

    Parameters:
        frame (numpy.ndarray): The image frame.
        bbox (tuple): Bounding box coordinates (x_min, y_min, x_max, y_max).
        label (str): Label text to display.
        color (tuple): RGB color for the bounding box (default is green).
        thickness (int): Thickness of the box border (default is 2).

    Returns:
        numpy.ndarray: The frame with the bounding box and label drawn.
    """
    # Extract bounding box coordinates
    x_min, y_min, x_max, y_max = bbox

    # Draw the rectangle
    cv2.rectangle(frame, (x_min, y_min), (x_max, y_max), color, thickness)

    # Set font and scale
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.5

    # Calculate text size and position
    text_size = cv2.getTextSize(label, font, font_scale, 1)[0]
    text_x = x_min
    text_y = y_min - 5 if y_min - 5 > 10 else y_min + text_size[1] + 5

    # Draw text background rectangle
    cv2.rectangle(
        frame, 
        (text_x, text_y - text_size[1] - 5), 
        (text_x + text_size[0], text_y + 5), 
        color, 
        -1
    )

    # Put the label text
    cv2.putText(frame, label, (text_x, text_y), font, font_scale, (255, 255, 255), 1)

    return frame

if __name__ == "__main__":
    while True:
        input_data = sys.stdin.readline().strip()
        if not input_data:
            break

        try:
            # Parse input data
            input_json = json.loads(input_data)
            frame_data = base64.b64decode(input_json['frame'])
            bboxes = input_json['bboxes']
            labels = input_json['labels']

            # Decode the input frame
            np_array = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(np_array, cv2.IMREAD_COLOR)

            # Draw bounding boxes
            for bbox, label in zip(bboxes, labels):
                frame = draw_bounding_box(frame, tuple(bbox), label)

            # Encode the processed frame
            _, buffer = cv2.imencode('.jpg', frame)
            encoded_frame = base64.b64encode(buffer).decode('utf-8')

            # Output the frame
            print(json.dumps({"frame": encoded_frame}))

        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
