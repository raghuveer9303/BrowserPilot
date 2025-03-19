from fastapi import APIRouter, HTTPException, Depends, status, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional, Union
import base64
import io
import asyncio
from ..config import Settings
from ..utils.browser_factory import BrowserFactory

router = APIRouter(prefix="/api/browser", tags=["browser"])

class ScreenshotResponse(BaseModel):
    image: str
    width: int
    height: int
    format: str = "png"

class PageInfoResponse(BaseModel):
    url: str
    title: str
    content_type: Optional[str] = None
    viewport: Dict[str, int]
    elements: Dict[str, int]

class ElementSelectorRequest(BaseModel):
    selector: str
    timeout: Optional[int] = None

class JavaScriptRequest(BaseModel):
    script: str
    args: Optional[List[Any]] = None

class NavigateRequest(BaseModel):
    url: str
    wait_until: Optional[str] = "load"
    timeout: Optional[int] = None

@router.post("/screenshot", response_model=ScreenshotResponse)
async def take_screenshot(
    session_id: str,
    fullPage: bool = False,
    browser_factory: BrowserFactory = Depends(lambda: BrowserFactory())
):
    """Take a screenshot of the current page"""
    try:
        # Create a browser context if not exists
        browser = await browser_factory.create_browser()
        page = await browser.new_page()
        
        # Take screenshot
        screenshot_bytes = await page.screenshot(full_page=fullPage, type="png")
        
        # Get page dimensions
        dimensions = await page.evaluate("""() => {
            return {
                width: document.documentElement.clientWidth,
                height: document.documentElement.clientHeight
            }
        }""")
        
        # Close page
        await page.close()
        
        # Convert to base64
        base64_image = base64.b64encode(screenshot_bytes).decode("utf-8")
        
        return {
            "image": base64_image,
            "width": dimensions["width"],
            "height": dimensions["height"],
            "format": "png"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to take screenshot: {str(e)}"
        )

@router.get("/info", response_model=PageInfoResponse)
async def get_page_info(
    session_id: str,
    browser_factory: BrowserFactory = Depends(lambda: BrowserFactory())
):
    """Get information about the current page"""
    try:
        # Create a browser context if not exists
        browser = await browser_factory.create_browser()
        page = await browser.new_page()
        
        # Get page information
        url = page.url
        title = await page.title()
        
        # Get content type
        response = await page.evaluate("""() => {
            return document.contentType || null;
        }""")
        
        # Get viewport dimensions
        viewport = await page.evaluate("""() => {
            return {
                width: window.innerWidth,
                height: window.innerHeight
            };
        }""")
        
        # Count elements
        element_counts = await page.evaluate("""() => {
            return {
                links: document.querySelectorAll('a').length,
                buttons: document.querySelectorAll('button').length,
                inputs: document.querySelectorAll('input').length,
                images: document.querySelectorAll('img').length,
                total: document.querySelectorAll('*').length
            };
        }""")
        
        # Close page
        await page.close()
        
        return {
            "url": url,
            "title": title,
            "content_type": response,
            "viewport": viewport,
            "elements": element_counts
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get page info: {str(e)}"
        )

@router.post("/navigate")
async def navigate_to_url(
    request: NavigateRequest,
    session_id: str,
    browser_factory: BrowserFactory = Depends(lambda: BrowserFactory())
):
    """Navigate to a URL"""
    try:
        # Create a browser context if not exists
        browser = await browser_factory.create_browser()
        page = await browser.new_page()
        
        # Set default timeout
        if request.timeout:
            page.set_default_timeout(request.timeout)
        
        # Navigate to URL
        response = await page.goto(
            request.url,
            wait_until=request.wait_until
        )
        
        if not response:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to navigate to {request.url}"
            )
        
        # Get page information
        title = await page.title()
        status_code = response.status
        
        # Close page
        await page.close()
        
        return {
            "url": request.url,
            "title": title,
            "status": status_code
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to navigate: {str(e)}"
        )

@router.post("/execute")
async def execute_javascript(
    request: JavaScriptRequest,
    session_id: str,
    browser_factory: BrowserFactory = Depends(lambda: BrowserFactory())
):
    """Execute JavaScript in the browser"""
    try:
        # Create a browser context if not exists
        browser = await browser_factory.create_browser()
        page = await browser.new_page()
        
        # Execute script
        args = request.args or []
        result = await page.evaluate(request.script, *args)
        
        # Close page
        await page.close()
        
        return {"result": result}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute JavaScript: {str(e)}"
        )

@router.post("/click")
async def click_element(
    request: ElementSelectorRequest,
    session_id: str,
    browser_factory: BrowserFactory = Depends(lambda: BrowserFactory())
):
    """Click an element on the page"""
    try:
        # Create a browser context if not exists
        browser = await browser_factory.create_browser()
        page = await browser.new_page()
        
        # Set timeout if provided
        if request.timeout:
            timeout = request.timeout
        else:
            timeout = 5000  # Default 5 seconds
        
        # Wait for selector and click
        await page.click(request.selector, timeout=timeout)
        
        # Close page
        await page.close()
        
        return {"success": True, "selector": request.selector}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to click element: {str(e)}"
        )