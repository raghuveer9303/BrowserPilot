import asyncio
from typing import Dict, Any, Optional
from playwright.async_api import async_playwright
import logging

logger = logging.getLogger(__name__)

class BrowserFactory:
    """Factory for creating and managing browser instances"""
    
    def __init__(self, headless: bool = False):
        self.headless = headless
        self.playwright = None
        self.browser = None
        self._initialized = False
        self._lock = asyncio.Lock()
    
    async def initialize(self):
        """Initialize the Playwright instance if not already done"""
        if self._initialized:
            return
            
        async with self._lock:
            if not self._initialized:
                self.playwright = await async_playwright().start()
                self._initialized = True
    
    async def create_browser(self, browser_type: str = "chromium", **kwargs):
        """Create a new browser instance"""
        await self.initialize()
        
        # Select browser type
        if browser_type == "firefox":
            browser_class = self.playwright.firefox
        elif browser_type == "webkit":
            browser_class = self.playwright.webkit
        else:
            browser_class = self.playwright.chromium
            
        # Set default viewport and user agent
        viewport = kwargs.get("viewport", {"width": 1280, "height": 720})
        user_agent = kwargs.get("user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        
        # When running in Docker with Xvfb/VNC, we need to set headless=False
        # but it will still work because it's running inside Xvfb
        browser = await browser_class.launch(
            headless=self.headless,
            args=['--no-sandbox', '--disable-dev-shm-usage'],
        )
        
        # Create a new context with the specified viewport and user agent
        context = await browser.new_context(
            viewport=viewport,
            user_agent=user_agent
        )
        
        return context
    
    async def close(self):
        """Close all browser instances and Playwright"""
        if not self._initialized:
            return
            
        async with self._lock:
            if self.browser:
                await self.browser.close()
                self.browser = None
                
            if self.playwright:
                await self.playwright.stop()
                self.playwright = None
                
            self._initialized = False