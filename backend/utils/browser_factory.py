import asyncio
from typing import Dict, Any, Optional
from playwright.async_api import async_playwright, Browser, BrowserContext
import logging

logger = logging.getLogger(__name__)

class BrowserFactory:
    """Factory for creating and managing browser instances"""
    
    def __init__(self, headless: bool = False):
        self.headless = headless
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
    
    async def create_browser(self, browser_type: str = "chromium", **kwargs) -> BrowserContext:
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
        logger.info(f"Launching {browser_type} browser")
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
    
    async def create_session_browser(self, session_id: str, browser_type: str = "chromium", **kwargs) -> BrowserContext:
        """Create a browser context for a specific session"""
        if session_id in self.contexts:
            logger.info(f"Returning existing browser context for session {session_id}")
            return self.contexts[session_id]
        
        logger.info(f"Creating new browser context for session {session_id}")
        context = await self.create_browser(browser_type, **kwargs)
        self.contexts[session_id] = context
        return context
    
    async def close_session(self, session_id: str) -> bool:
        """Close a specific session's browser context"""
        if session_id not in self.contexts:
            return False
            
        context = self.contexts[session_id]
        await context.close()
        del self.contexts[session_id]
        return True
    
    async def close(self):
        """Close all browser instances and Playwright"""
        if not self._initialized:
            return
            
        async with self._lock:
            # Close all contexts
            for session_id, context in list(self.contexts.items()):
                try:
                    await context.close()
                except Exception as e:
                    logger.error(f"Error closing browser context for session {session_id}: {str(e)}")
            
            self.contexts = {}
                
            if self.browser:
                await self.browser.close()
                self.browser = None
                
            if self.playwright:
                await self.playwright.stop()
                self.playwright = None
                
            self._initialized = False
            logger.info("Closed all browser instances and Playwright")