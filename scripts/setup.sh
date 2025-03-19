#!/bin/bash
# Setup script for BrowserPilot dependencies

echo "Setting up BrowserPilot..."

# Install Python dependencies
pip install -r requirements.txt

# Install system dependencies (if needed)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Installing Linux dependencies..."
    sudo apt-get update
    sudo apt-get install -y x11vnc xvfb novnc
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Installing macOS dependencies..."
    brew install novnc
fi

# Install Playwright browsers
python -m playwright install chromium

# Create required directories
mkdir -p results

# Create .env file if not exists
if [ ! -f .env ]; then
    echo "Creating default .env file..."
    cp .env.example .env
    echo "Please edit .env with your API keys"
fi

echo "Setup complete. Run 'python main.py' to start BrowserPilot."