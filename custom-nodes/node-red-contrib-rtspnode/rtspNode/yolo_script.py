import os
import sys
from ultralytics import YOLO
import matplotlib.pyplot as plt
import cv2

# Ensure to use the path from command line arguments
if len(sys.argv) != 2:
    print("Usage: python yolo_script.py <image_path>")
    sys.exit(1)

image_path = sys.argv[1]

model = YOLO('yolov8n.pt') 

# Function to perform detection on an image
def detect_objects(image_path):
    # Perform inference
    results = model.predict(image_path)
    
    # Print results
    print(results)
    
    save_dir = '/app/output'
    os.makedirs(save_dir, exist_ok=True)
    print(f"Directory created or already exists: {save_dir}")
    
    for i, result in enumerate(results):
        img = result.plot()  # This returns an image array
        
        save_path = os.path.join(save_dir, f'result_{i}.jpg')
        print(f"Saving image to {save_path}")
        
        success = cv2.imwrite(save_path, img)
        if not success:
            print(f"Failed to save image at {save_path}")
        
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        plt.imshow(img_rgb)
        plt.axis('off')
        plt.show()

detect_objects(image_path)
