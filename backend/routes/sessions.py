from fastapi import APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
import asyncio
from ..config import Settings
from ..utils.browser_factory import BrowserFactory
from ..utils.session_manager import SessionManager

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

class SessionCreate(BaseModel):
    name: Optional[str] = None
    browser_type: str = "chromium"
    parameters: Dict[str, Any] = {}

class AgentTask(BaseModel):
    instructions: str
    model: Optional[str] = None

class SessionResponse(BaseModel):
    id: str
    name: str
    browser_type: str
    status: str
    created_at: float
    error: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    session_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

# Dependency to get the session manager
async def get_session_manager(
    settings: Settings = Depends(lambda: Settings()),
    browser_factory: BrowserFactory = Depends(lambda: BrowserFactory(headless=not settings.debug))
) -> SessionManager:
    # Initialize browser factory if not already done
    await browser_factory.initialize()
    return SessionManager(settings, browser_factory)

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """Create a new browser session"""
    session = await session_manager.create_session(
        name=data.name,
        browser_type=data.browser_type,
        parameters=data.parameters
    )
    return session

@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    session_manager: SessionManager = Depends(get_session_manager)
):
    """List all sessions"""
    return await session_manager.list_sessions()

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """Get session details"""
    session = await session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """Delete a session"""
    success = await session_manager.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return None

@router.post("/{session_id}/run", response_model=TaskResponse)
async def run_agent_task(
    session_id: str,
    task: AgentTask,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """Run an agent task on a session"""
    try:
        session = await session_manager.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Generate task ID
        task_id = str(uuid.uuid4())
        
        # Run task asynchronously
        asyncio.create_task(session_manager.run_agent_task(session_id, task.instructions, task.model))
        
        return {
            "id": task_id,
            "session_id": session_id,
            "status": "running"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/ws/{session_id}")
async def websocket_session_updates(
    websocket: WebSocket,
    session_id: str,
    session_manager: SessionManager = Depends(get_session_manager)
):
    """WebSocket for real-time session updates"""
    await websocket.accept()
    try:
        await session_manager.register_websocket(session_id, websocket)
        while True:
            # Keep the connection alive with periodic pings
            await asyncio.sleep(30)
            await websocket.send_text('{"type":"ping"}')
    except WebSocketDisconnect:
        await session_manager.unregister_websocket(session_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await session_manager.unregister_websocket(session_id, websocket)