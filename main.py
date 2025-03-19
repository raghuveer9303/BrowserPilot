#!/usr/bin/env python3
"""
BrowserPilot - Main Application Entry Point
"""
import os
import uvicorn
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("browserpilot")

if __name__ == "__main__":
    logger.info("Starting BrowserPilot")
    
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