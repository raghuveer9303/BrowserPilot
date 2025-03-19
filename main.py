#!/usr/bin/env python3
"""
BrowserPilot - Main Application Entry Point
"""
import os
import asyncio
import uvicorn
import logging
import sys
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),  # Log to stdout
        logging.StreamHandler(sys.stderr),  # Log to stderr
    ],
)
logger = logging.getLogger("browserpilot")

def create_directories():
    """Create necessary directories if they don't exist"""
    dirs = ["results", "logs"]
    for directory in dirs:
        Path(directory).mkdir(exist_ok=True)

async def check_dependencies():
    """Check for required dependencies"""
    try:
        # Check if browser-use is installed
        import browser_use
        logger.info("browser-use package found")
    except ImportError:
        logger.error("browser-use package not found. Please install it first.")
        exit(1)

    try:
        # Check if playwright is installed
        from playwright.async_api import async_playwright
        logger.info("playwright package found")
    except ImportError:
        logger.error("playwright package not found")
        exit(1)

if __name__ == "__main__":
    logger.info("Starting BrowserPilot")
    
    # Create necessary directories
    create_directories()
    
    # Check dependencies
    asyncio.run(check_dependencies())
    
    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
    
    # Start application
    logger.info(f"Server running at http://{host}:{port}")
    uvicorn.run(
        "backend.app:app", 
        host=host, 
        port=port, 
        reload=debug
    )