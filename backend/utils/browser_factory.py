import os
import asyncio
from typing import Dict, Any, Optional
from playwright.async_api import async_playwright, Browser, BrowserContext
import logging

logger = logging.getLogger(__name__)

class BrowserFactory:
    """Factory for creating and managing browser instances"""
    
    def __init__(self, headless: bool = False):
        self.headless = headless  # Keep this parameter, but we'll override it later
        self.playwright = None
        self.browser = None
        self.contexts = {}  # session_id -> browser_context
        self._initialized = False
        self._lock = asyncio.Lock()
    
    async def initialize(self):
        """Initialize the Playwright instance if not already done"""
        if self._initialized:
            return
            
        async with self._lock:
            if not self._initialized:
                logger.info("Initializing Playwright")
                self.playwright = await async_playwright().start()
                self._initialized = True
    
    async def create_browser(self, browser_type: str = "chromium", **kwargs) -> Browser:
        """Create a new browser instance"""
        await self.initialize()

        # Log the received kwargs for debugging
        logger.debug(f"Received kwargs: {kwargs}")

        # Ensure DISPLAY environment variable is set
        os.environ["DISPLAY"] = ":99"

        # Select browser type
        if browser_type == "firefox":
            browser_class = self.playwright.firefox
        elif browser_type == "webkit":
            browser_class = self.playwright.webkit
        else:
            browser_class = self.playwright.chromium

        # Create launch options dictionary with only JSON-serializable values
        # IMPORTANT: Set headless to False for VNC visibility
        launch_options = {
            "headless": False,  # Force visible mode for VNC
            "args": [
                "--no-sandbox", 
                "--disable-dev-shm-usage",
                "--disable-gpu"  # Helps with rendering in container environments
            ]
        }

        # Add any additional JSON-serializable kwargs
        for key, value in kwargs.items():
            if isinstance(value, (str, int, float, bool, list, dict)):
                launch_options[key] = value
            else:
                logger.warning(f"Ignoring non-serializable kwarg: {key}={value}")

        logger.info(f"Launching {browser_type} browser with args: {launch_options['args']}")
        logger.debug(f"Launch options: {launch_options}")

        # Launch browser with JSON-serializable options
        browser = await browser_class.launch(**launch_options)

        return browser