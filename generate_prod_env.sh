#!/bin/bash

folders=(
  "custom-nodes/node-red-contrib-objectdetectnode"
  "custom-nodes/node-red-contrib-rtspnode"
  "custom-nodes/node-red-contrib-dockernode"
  "custom-nodes/node-red-contrib-inputnode"
  "custom-nodes/node-red-contrib-outputnode"
  "custom-nodes/node-red-contrib-videofeednode"
  "custom-nodes/node-red-contrib-objectmodelnode"
  "custom-nodes/node-red-contrib-roinode"
  "custom-nodes/node-red-contrib-videoviewnode"
)

for folder in "${folders[@]}"; do
  
  env_file="$folder/.env"
  if [ -f "$env_file" ]; then
    rm "$env_file"
  fi
  echo "Creating $env_file"
  echo "PERCEPTO_BACKEND_API=http://183.82.144.156:4500" >> "$env_file"
  echo "PERCEPTO_NODE_RED_API=http://183.82.144.156:1880" >> "$env_file"
  echo "PERCEPTO_LOCAL_NGINX_URL=http://183.82.144.156:3077" >> "$env_file"
  
done
