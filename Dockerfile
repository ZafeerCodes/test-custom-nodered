# Use the Node.js base image
FROM node:20.17.0

# Install Python and pip3
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# Create the expected .node-red directory structure
RUN mkdir -p /root/.node-red

# Set the working directory to .node-red
WORKDIR /root/.node-red

# Install pnpm globally
RUN npm install -g pnpm

# Copy package.json and pnpm-lock.yaml to the container
COPY package*.json ./

# Copy all files into the .node-red directory
COPY . .

# Install Node.js dependencies
RUN pnpm install

# Build any necessary assets
RUN pnpm build

# Make the install_nodes.sh script executable
RUN chmod +x install_nodes.sh

# Run the custom installation script for Node-RED nodes
RUN ./install_nodes.sh

# Expose the Node-RED default port
EXPOSE 1880

# Start Node-RED
CMD ["pnpm", "start"]
