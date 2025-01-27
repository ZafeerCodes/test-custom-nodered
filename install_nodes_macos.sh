#!/bin/bash
 
# Array of folder names
folders=(
    # "custom-nodes/node-red-contrib-objectdetectnode"
    # "custom-nodes/node-red-contrib-rtspnode"
    # "custom-nodes/node-red-contrib-dockernode"
    # "custom-nodes/node-red-contrib-inputnode"
    "custom-nodes/node-red-contrib-outputnode"
    "custom-nodes/node-red-contrib-videofeednode",
    "custom-nodes/node-red-contrib-objectmodelnode"
    "custom-nodes/node-red-contrib-roinode"
    "custom-nodes/node-red-contrib-videoviewnode"
    "custom-nodes/node-red-contrib-classificationnode"
    "custom-nodes/node-red-contrib-gstvideofeednode"
    "custom-nodes/node-red-contrib-databasenode"
)
 
# Change to the parent directory of the folders
current_dir=$(pwd)
 
# Loop through the folders and open terminals, running 'pnpm install'
for folder in "${folders[@]}"; do
  full_path="$current_dir/$folder"
  osascript -e "tell application \"Terminal\" to do script \"cd $full_path && source ~/.nvm/nvm.sh && pnpm install  && if [ $? -eq 0 ]; then cd ~/.node-red && pnpm install $full_path; fi\""
done
 
 
# To run this file
#   sh install_nodes.sh
#   sudo ./install_nodes.sh