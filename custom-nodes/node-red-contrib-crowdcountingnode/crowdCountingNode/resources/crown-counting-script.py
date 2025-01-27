import cv2
import numpy as np
import torch
from torchvision import transforms
from models import M_SFANet_UCF_QNRF
from PIL import Image
import json
import sys
import base64
import io
import argparse

# Define the command-line argument parser
parser = argparse.ArgumentParser(description='Crowd Counting Model Parameters')
parser.add_argument('--name', type=str, default='crowd counting', help='Name of the process')
parser.add_argument('--model', type=str, default='SFANET', help='Model type')
parser.add_argument('--fontSize', type=int, default=12, help='Font size for the overlay text')
parser.add_argument('--fontColor', type=str, default='#FFFFFF', help='Font color for the overlay text')
parser.add_argument('--fontScale', type=float, default=1.0, help='Font scale for the overlay text')
parser.add_argument('--fontThickness', type=int, default=2, help='Font thickness for the overlay text')

args = parser.parse_args()

# Convert hex color to RGB
def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

# Convert font color from hex to RGB
font_color = hex_to_rgb(args.fontColor)

# Check if CUDA (GPU) is available
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
 
# Preprocessing transforms
trans = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])


model_weights_path = "custom-nodes/node-red-contrib-crowdcountingnode/crowdCountingNode/resources/best_M-SFANet*_UCF_QNRF.pth"
# Load the model
def load_model(model_weights_path):
    """
    Load the pre-trained model and weights.
    """
    model = M_SFANet_UCF_QNRF.Model().to(device)
    if torch.cuda.is_available():
        # Load on GPU
        model.load_state_dict(torch.load(model_weights_path))
    else:
        # Load on CPU
        model.load_state_dict(torch.load(model_weights_path, map_location=torch.device('cpu')))
    model.eval()
    return model
 

model = load_model(model_weights_path)    
 
 
def load_and_preprocess_image(image_buffer, roi=None):
    """
    Load and preprocess the image for the model. Resize to the desired ROI dimensions.

    """

    frame = cv2.imdecode(np.frombuffer(image_buffer, np.uint8), cv2.IMREAD_COLOR)
    img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
 
    if roi is not None:
        # Crop the image to the ROI
        x, y, w, h = roi
        img_cropped = img[y:y+h, x:x+w]
    else:
        img_cropped = img
 
    img_resized = cv2.resize(img_cropped, (512, 512), cv2.INTER_CUBIC)
    img_tensor = trans(Image.fromarray(img_resized))[None, :].to(device)
    return img, img_cropped, img_tensor
 
def run_inference(model, img_tensor):
    """
    Run inference on the preprocessed image tensor and return the density map.
    """
    with torch.no_grad():
        density_map = model(img_tensor)
    return density_map
 
def process_density_map(density_map, width, height):
    """
    Post-process the density map for visualization.
    """
    density_map_np = density_map.cpu().squeeze().numpy()
    density_map_resized = cv2.resize(density_map_np, (width, height))
 
    density_map_resized = np.clip(density_map_resized, 0, np.percentile(density_map_resized, 99))
    density_map_resized = (density_map_resized - density_map_resized.min()) / (density_map_resized.max() - density_map_resized.min())
    density_map_resized = (density_map_resized * 255).astype(np.uint8)
    return density_map_resized
 
def overlay_heatmap_on_image(img, est_count, roi):
    """
    Overlay heatmap on the resized image and add the count text and ROI rectangle.
    """
    # heatmap = cv2.applyColorMap(density_map_resized, cv2.COLORMAP_JET)
    # overlay = cv2.addWeighted(img_resized, 0.6, heatmap, 0.4, 0)
 
    # Add crowd count text
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1
    # font_color = (255, 255, 255)
    thickness = 2
    text = f'Crowd Count: {int(est_count)}'
    cv2.putText(img, text, (40, 40), font, args.fontScale, font_color, args.fontThickness, cv2.LINE_AA)
    # Draw ROI rectangle on the original image (if provided)
    if roi is not None:
        x, y, w, h = roi
        cv2.rectangle(img, (x, y), (x + w, y + h), (0, 255, 0), 2)
    return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
 
def save_image_with_overlay(output_path, overlay_image):
    """
    Save the image with overlay and crowd count to disk.
    """
    cv2.imwrite(output_path, overlay_image)
    print(f"Image saved at {output_path}")


if __name__ == "__main__":
    
    while True:
        try:

            base64_image = sys.stdin.readline().strip()
            try:
                arr_decoded = base64.b64decode(sys.stdin.readline().strip()).decode('utf-8')
                new_roi = json.loads(arr_decoded)
                roi = (int(new_roi[0]), int(new_roi[1]), int(new_roi[2]), int(new_roi[3]))
            except:
                roi = None
                # roi = (100, 100, 100, 100)
            
            # arr_decoded = base64.b64decode(sys.stdin.readline().strip()).decode('utf-8')
            # new_roi = json.loads(arr_decoded)
            # roi = (int(new_roi[0]), int(new_roi[1]), int(new_roi[2]), int(new_roi[3]))
            # print(roi, type(roi), roi[0])
            if not base64_image:
                break

            # Decode base64 to image buffer
            image_buffer = base64.b64decode(base64_image)

            img, img_cropped, img_tensor = load_and_preprocess_image(image_buffer, roi)

            # Run inference
            density_map = run_inference(model, img_tensor)
        
            # Calculate estimated count
            est_count = torch.sum(density_map).item()

            # Post-process density map
            # height, width = img_resized.shape[:2]
            # density_map_resized = process_density_map(density_map, width, height)
        
            # Overlay heatmap and crowd count on the image
            overlay_image = overlay_heatmap_on_image(img, est_count, roi)
             # Convert the annotated frame to a format that can be JSON serialized

            #to buffer 
            _, buffer = cv2.imencode('.jpg', overlay_image)
            base64_image = base64.b64encode(buffer).decode('utf-8')
        
            # Send the result back to Node.js
            print(base64_image)
            sys.stdout.flush()
        
        except Exception as e:
            print(f"Error: {str(e)}", file=sys.stderr)
            sys.stderr.flush()
            break

    print("Python script exiting", file=sys.stderr)
    sys.stderr.flush()