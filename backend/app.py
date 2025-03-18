from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import json
import uuid
import os
from browser_use import BrowserUse
from .agent_manager import AgentManager
from .config import Settings
from .utils.browser_factory import BrowserFactory
from .utils.result_storage import ResultStorage

app = FastAPI(title="BrowserPilot")

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
browser_factory = BrowserFactory()
result_storage = ResultStorage()
agent_manager = AgentManager(settings, browser_factory, result_storage)

# Mount static files for frontend
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Models
class Task(BaseModel):
    instructions: str
    url: Optional[str] = None
    model: str = "default"
    max_steps: int = 10
    parameters: Dict[str, Any] = {}

class TaskResponse(BaseModel):
    task_id: str
    status: str

@app.post("/api/tasks", response_model=TaskResponse)
async def create_task(task: Task):
    """Submit a new browser automation task"""
    task_id = str(uuid.uuid4())
    await agent_manager.create_task(task_id, task)
    return {"task_id": task_id, "status": "created"}

@app.get("/api/tasks/{task_id}")
async def get_task_status(task_id: str):
    """Get status and results of a task"""
    status = await agent_manager.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    return status

@app.delete("/api/tasks/{task_id}")
async def cancel_task(task_id: str):
    """Cancel a running task"""
    success = await agent_manager.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "cancelled"}

@app.websocket("/ws/tasks/{task_id}")
async def websocket_task_updates(websocket: WebSocket, task_id: str):
    """WebSocket endpoint for real-time task updates"""
    await websocket.accept()
    try:
        await agent_manager.register_websocket(task_id, websocket)
        while True:
            # Keep connection alive, actual messages sent by agent_manager
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        await agent_manager.unregister_websocket(task_id, websocket)

@app.get("/api/vnc_info")
async def get_vnc_info():
    """Get VNC connection information"""
    # This could be dynamic in a multi-container setup
    return {
        "websocket_url": f"ws://{settings.host}:{settings.novnc_port}/websockify",
        "password": os.environ.get("VNC_PASSWORD", "password"),
    }

@app.get("/")
async def root():
    """Redirect to UI"""
    return {"message": "BrowserPilot API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=settings.port, reload=True)