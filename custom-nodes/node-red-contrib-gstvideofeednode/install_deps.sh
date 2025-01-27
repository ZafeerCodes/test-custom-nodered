
#!/bin/bash

# Run the below command to give permission
# chmod +x install_deps.sh 

# Script to update the package list and install GStreamer packages

# Exit on any error
set -e

# Function to install on Ubuntu
install_ubuntu() {
    echo "Updating package list..."
    sudo apt-get update

    echo "Installing GStreamer packages..."
    sudo apt-get install -y \
        gstreamer1.0-tools \
        gstreamer1.0-plugins-base \
        gstreamer1.0-plugins-good \
        gstreamer1.0-plugins-bad \
        gstreamer1.0-plugins-ugly \
        gstreamer1.0-libav \
        libgstreamer-plugins-base1.0-dev \
        gstreamer1.0-gtk3
    echo "GStreamer packages have been successfully installed on Ubuntu."
}

# Function to install on macOS
install_macos() {
    echo "Checking for Homebrew..."
    if ! command -v brew &>/dev/null; then
        echo "Homebrew not found. Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi

    echo "Updating Homebrew..."
    brew update

    echo "Installing GStreamer packages..."
    brew install \
        gstreamer \
        gst-plugins-base \
        gst-plugins-good \
        gst-plugins-bad \
        gst-plugins-ugly \
        gst-libav \
        gst-gtk

    echo "GStreamer packages have been successfully installed on macOS."
}

# Detect OS and call the appropriate function
if [[ "$(uname -s)" == "Linux" ]]; then
    install_ubuntu
elif [[ "$(uname -s)" == "Darwin" ]]; then
    install_macos
else
    echo "Unsupported operating system."
    exit 1
fi

