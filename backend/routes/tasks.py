from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
import asyncio
import time
from ..config import Settings
from ..agent_manager import AgentManager
from ..dependencies import get_agent_manager  # Add this import

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

class TaskCreate(BaseModel):
    instructions: str
    url: Optional[str] = None
    model: str = "default"
    max_steps: int = 10
    parameters: Dict[str, Any] = {}
    session_id: Optional[str] = None

class TaskResponse(BaseModel):
    id: str = Field(..., alias="task_id")
    status: str
    instructions: str
    created_at: float
    model: str
    steps: list[dict[str, any]] = []  # 'any' remains unchanged
    result: Optional[dict[str, any]] = None
    error: Optional[str] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskCreate,
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    """Create a new browser automation task"""
    task_id = str(uuid.uuid4())
    
    # Create task data
    task_data = task.dict()
    
    try:
        await agent_manager.create_task(task_id, task_data)
        return {
            "task_id": task_id,  # Changed key from "id" to "task_id"
            "status": "initializing",
            "instructions": task.instructions,
            "created_at": time.time(),
            "model": task.model,
            "steps": [],
            "result": None,
            "error": None,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    limit: int = 100,
    offset: int = 0,
    status: Optional[str] = None,
    agent_manager: AgentManager = Depends(lambda: AgentManager)
):
    """List all tasks with optional filtering"""
    return await agent_manager.list_tasks(limit, offset, status)

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    agent_manager: AgentManager = Depends(lambda: AgentManager)
):
    """Get task status and details"""
    status = await agent_manager.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    return status

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_task(
    task_id: str,
    agent_manager: AgentManager = Depends(lambda: AgentManager)
):
    """Cancel a running task"""
    success = await agent_manager.cancel_task(task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return None

@router.websocket("/ws/{task_id}")  # This combines with the router prefix to become /api/tasks/ws/{task_id}
async def websocket_task_updates(
    websocket: WebSocket,
    task_id: str,
    agent_manager: AgentManager = Depends(get_agent_manager)
):
    await websocket.accept()
    try:
        await agent_manager.register_websocket(task_id, websocket)
        while True:
            await asyncio.sleep(30)
            await websocket.send_text('{"type":"ping"}')
    except WebSocketDisconnect:
        await agent_manager.unregister_websocket(task_id, websocket)