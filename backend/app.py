from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, RedirectResponse
from contextlib import asynccontextmanager
import os
import logging
import asyncio
import websockets
from backend.config import Settings
from backend.utils.browser_factory import BrowserFactory
from backend.utils.result_storage import ResultStorage
from backend.agent_manager import AgentManager
from backend.routes import routers

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("browserpilot")

# Initialize application
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan handler for startup and shutdown events."""
    logger.info("BrowserPilot starting up")
    
    # Ensure result storage directory exists
    os.makedirs(settings.result_storage_path, exist_ok=True)
    
    # Initialize browser factory
    await browser_factory.initialize()
    
    logger.info(f"BrowserPilot started on http://{settings.host}:{settings.port}")
    logger.info(f"VNC available at port {settings.vnc_port}")
    logger.info(f"noVNC available at port {settings.novnc_port}")
    
    yield  # Application runs here
    
    logger.info("BrowserPilot shutting down")
    await browser_factory.close()

app = FastAPI(
    title="BrowserPilot",
    description="AI-powered browser automation",
    version="0.1.0",
    lifespan=lifespan
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

# Mount noVNC
app.mount("/novnc", StaticFiles(directory="/usr/share/novnc"), name="novnc")

# Include all routers
for router in routers:
    app.include_router(router)

# Root endpoint
@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the frontend application"""
    return RedirectResponse(url="/static/index.html")

@app.websocket("/websockify")
async def websockify(websocket: WebSocket):
    await websocket.accept()
    
    vnc_socket = None
    try:
        # Connect to VNC server
        vnc_socket = await websockets.connect('ws://localhost:5900')
        
        # Handle bidirectional communication
        async def forward_to_vnc():
            try:
                while True:
                    data = await websocket.receive_bytes()
                    await vnc_socket.send(data)
            except Exception:
                pass

        async def forward_to_client():
            try:
                while True:
                    data = await vnc_socket.recv()
                    await websocket.send_bytes(data)
            except Exception:
                pass

        # Run both forwards concurrently
        await asyncio.gather(
            forward_to_vnc(),
            forward_to_client()
        )
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if vnc_socket:
            await vnc_socket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host=settings.host, port=settings.port, reload=settings.debug)