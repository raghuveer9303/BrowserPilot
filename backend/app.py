from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, RedirectResponse
import os
import logging
from .agent_manager import AgentManager
from .config import Settings
from .utils.browser_factory import BrowserFactory
from .utils.result_storage import ResultStorage
from .utils.logger import setup_logger
from .routes import routers

# Setup logging
logger = setup_logger("browserpilot", os.environ.get("LOG_LEVEL", "INFO"))

# Initialize application
app = FastAPI(
    title="BrowserPilot",
    description="AI-powered browser automation",
    version="0.1.0"
)

# Load configuration
settings = Settings()

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
browser_factory = BrowserFactory(headless=not settings.debug)
result_storage = ResultStorage(storage_path=settings.result_storage_path)
agent_manager = AgentManager(settings, browser_factory, result_storage)

# Mount static files for frontend
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Include all routers
for router in routers:
    app.include_router(router)


@app.websocket_route("/websockify")
async def websockify(websocket):
    await websocket.accept()
    # Proxy WebSocket connection to VNC server
    # You'll need to implement the proxy logic here

# Root endpoint
@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the frontend application"""
    return RedirectResponse(url="/static/index.html")

@app.on_event("startup")
async def startup_event():
    """Application startup event hook"""
    logger.info("BrowserPilot starting up")
    
    # Ensure result storage directory exists
    os.makedirs(settings.result_storage_path, exist_ok=True)
    
    # Initialize browser factory
    await browser_factory.initialize()
    
    logger.info(f"BrowserPilot started on http://{settings.host}:{settings.port}")

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event hook"""
    logger.info("BrowserPilot shutting down")
    
    # Close browser instances
    await browser_factory.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host=settings.host, port=settings.port, reload=settings.debug)