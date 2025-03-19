#!/bin/bash
# Initialize BrowserPilot environment

set -e

# Create required directories
mkdir -p results
mkdir -p logs

# Check for environment file
if [ ! -f .env ]; then
    echo "Creating default .env file..."
    cp .env.example .env
    echo "Please edit .env with your API keys"
fi

# Install Playwright browsers if not installed
if ! python -c "from playwright.sync_api import sync_playwright; sync_playwright().start()" &> /dev/null; then
    echo "Installing Playwright browsers..."
    python -m playwright install chromium
fi

# Setup noVNC if running on Linux
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Check if Xvfb is running
    if ! pgrep Xvfb > /dev/null; then
        echo "Starting Xvfb..."
        Xvfb :99 -screen 0 1280x720x24 -ac &
        export DISPLAY=:99
    fi
    
    # Check if x11vnc is running
    if ! pgrep x11vnc > /dev/null; then
        echo "Starting x11vnc..."
        x11vnc -display :99 -forever -shared -nopw -quiet &
    fi
    
    # Check if noVNC is running
    if ! pgrep websockify > /dev/null; then
        echo "Starting noVNC..."
        /usr/share/novnc/utils/launch.sh --vnc localhost:5900 --listen 6080 &
    fi
fi

echo "Environment initialized. Run 'python main.py' to start BrowserPilot."