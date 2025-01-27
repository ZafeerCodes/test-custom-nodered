---

# GStreamer Setup for Node-RED Custom Node

This guide will help you set up GStreamer for your Node-RED custom node that processes video streams, extracts frames from both video files and RTSP streams, and forwards the frames for further processing.

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Installing GStreamer](#installing-gstreamer)
4. [Using GStreamer in Node-RED Custom Node](#using-gstreamer-in-node-red-custom-node)
5. [Testing the Setup](#testing-the-setup)
6. [Troubleshooting](#troubleshooting)

---

## Introduction

This custom Node-RED node utilizes GStreamer to extract video frames from two types of input sources:

- **Video files** (e.g., `.mp4`)
- **RTSP streams** (Real-Time Streaming Protocol)

Frames are extracted based on the provided frame rate and forwarded to the next node in the Node-RED flow for further processing.

---

## Prerequisites

Before proceeding, ensure you have the following:

- **Node-RED** installed on your system.
- **GStreamer** installed and configured.
- **Node.js** installed on your system.
- Basic familiarity with Node-RED custom node development.

---

## Installing GStreamer

To install GStreamer, follow the steps based on your operating system.

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav libgstreamer-plugins-base1.0-dev gstreamer1.0-tools gstreamer1.0-gtk3 gstreamer1.0-ffmpeg
```

### Fedora/RHEL/CentOS
```bash
sudo dnf install gstreamer1 gstreamer1-plugins-base gstreamer1-plugins-good gstreamer1-plugins-bad gstreamer1-plugins-ugly
```

### macOS (using Homebrew)
```bash
brew install gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly
```

### Windows

1. Download the GStreamer installer from the official website: [https://gstreamer.freedesktop.org/download/](https://gstreamer.freedesktop.org/download/)
2. Run the installer and select the "Complete" installation option.
3. Add GStreamer to your system's PATH by updating your environment variables.

---

## Using GStreamer in Node-RED Custom Node

1. **Clone or Create Your Custom Node**  
   If you haven't already created the custom node, follow the [Node-RED custom node documentation](https://nodered.org/docs/creating-nodes/) to create a new node module.

2. **Add GStreamer Command to Extract Frames**  
   Based on the input type (video file or RTSP), the following GStreamer pipelines will be used in your custom node to extract frames.

   **For video files**:
   ```bash
   gst-launch-1.0 filesrc location=/path/to/video.mp4 ! decodebin ! videorate ! video/x-raw,framerate=30/1 ! videoconvert ! appsink name=sink
   ```

   **For RTSP streams**:
   ```bash
   gst-launch-1.0 rtspsrc location=rtsp://your.rtsp.url ! rtph264depay ! decodebin ! videorate ! video/x-raw,framerate=30/1 ! videoconvert ! appsink name=sink
   ```

3. **Install Node.js Child Process Package**  
   To execute GStreamer commands from Node-RED, you'll use the Node.js `child_process` module. Install it using:

   ```bash
   npm install --save child_process
   ```

4. **Configure Your Node-RED Custom Node**  
   In your custom node’s JavaScript file, configure GStreamer to run based on the input type (file or RTSP). Refer to the sample code structure in the project.

---


---

## Install and test required packages

1. **Build, Run, Test with command**  
    Goto file directory on terminal and try to execute these commands:
    For rtsp: 
    GENERATE BUILD
   ```bash
   gcc rtsp_gstreamer.c -o rtsp_gstreamer `pkg-config --cflags --libs gstreamer-1.0`
   ```

   RUN 
   ```bash
   ./rtsp_gstreamer rtsp://your:rtsp:url 30
   ```

   TEST 
   ```bash
   GST_DEBUG=3 ./rtsp_gstreamer rtsp://your:rtsp:url 30
   ```

   For Static file:
   GENERATE BUILD

   ```bash
   gcc file_gstreamer.c -o file_gstreamer `pkg-config --cflags --libs gstreamer-1.0`
   ```
   RUN
   ```bash
   ./file_gstreamer /home/file/path/test.mp4 30
   ```

   TEST
   ```bash
   GST_DEBUG=3 ./file_gstreamer /home/file/path/test.mp4 30
   ```

---

## Testing the Setup

Once you’ve installed GStreamer and configured your custom Node-RED node, you can test it by:

1. **Deploying the Node**: Add the custom node to your Node-RED flow.
2. **Input Feed**: Provide either a video file path or an RTSP URL.
3. **Frame Rate**: Specify the desired frame rate (FPS).
4. **Output**: Check the output payload for extracted frame data, which should be forwarded to the next node in the flow.

---

## Troubleshooting

- **Permission Denied**: Ensure you have the correct permissions for the input video file or RTSP stream.
- **Missing GStreamer Plugins**: If you encounter an error about missing GStreamer plugins, verify you have installed the correct plugin packages (`good`, `bad`, `ugly`).
- **GStreamer Process Not Starting**: Check if GStreamer is in your system’s PATH. You can confirm this by running `gst-launch-1.0` from the command line.

---

## Additional Resources

- [Node-RED Custom Node Documentation](https://nodered.org/docs/creating-nodes/)
- [GStreamer Official Documentation](https://gstreamer.freedesktop.org/documentation/)
- [GStreamer Pipelines Reference](https://gstreamer.freedesktop.org/documentation/application-development/pipeline.html)

---
