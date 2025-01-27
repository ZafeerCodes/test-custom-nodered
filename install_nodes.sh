#!/bin/bash

# Array of folder names
folders=(
  # "custom-nodes/node-red-contrib-objectdetectnode"
  # "custom-nodes/node-red-contrib-rtspnode"
  # "custom-nodes/node-red-contrib-dockernode"
  # "custom-nodes/node-red-contrib-testnode"
  "custom-nodes/node-red-contrib-inputnode"
  "custom-nodes/node-red-contrib-outputnode"
  # "custom-nodes/node-red-contrib-videofeednode"
  # "custom-nodes/node-red-contrib-objectmodelnode"
  # "custom-nodes/node-red-contrib-roinode"
  # "custom-nodes/node-red-contrib-classificationnode"
  # "custom-nodes/node-red-contrib-videoviewnode"
  # "custom-nodes/node-red-contrib-heatmapdetectionnode"
  # "custom-nodes/node-red-contrib-gstvideofeednode"
  # "custom-nodes/node-red-contrib-crowdcountingnode"
  # "custom-nodes/node-red-contrib-multilanguagenode"
  # "custom-nodes/node-red-contrib-falldetection"
  # "custom-nodes/node-red-contrib-databasenode"
  # "custom-nodes/node-red-contrib-facerecognitionnode"
  # "custom-nodes/node-red-contrib-facedetectionnode"
  # "custom-nodes/node-red-contrib-objectcountnode"
  # "custom-nodes/node-red-contrib-lprnode"
  # "custom-nodes/node-red-contrib-objectdetectionnode"
  "custom-nodes/node-red-contrib-azureimageanalysis"
  "custom-nodes/node-red-contrib-azurellmnode"
  "custom-nodes/node-red-contrib-chatviewnode"
)


# Get the current directory
current_dir=$(pwd)

# Loop through the folders
for folder in "${folders[@]}"; do
  full_path="$current_dir/$folder"
  echo "Processing $folder..."
  
  # Change to the node folder
  cd "$full_path"
  
  # Run pnpm install in the node folder
  echo "Running pnpm install..."
  pnpm install
  
  # Check if requirements.txt exists and run pip install if it does
  if [ -f "requirements.txt" ]; then
    echo "Found requirements.txt, running pip3 install..."
    pip3 install -r requirements.txt
  fi
  
  # Install the node in Node-RED
  echo "Installing node in Node-RED..."
  cd ~/.node-red && pnpm install "$full_path"

  npm rebuild canvas
  
  echo "Completed processing $folder"
  echo "------------------------"
done

echo "All installations completed!"