from fastapi import APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
from ..config import Settings
from ..utils.browser_factory import BrowserFactory
from ..utils.session_manager import SessionManager

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

class SessionCreate(BaseModel):
    name: Optional[str] = None
    browser_type: str = "chromium"
    parameters: Dict[str, Any] = {}

class SessionResponse(BaseModel):
    id: str
    name: str
    browser_type: str
    status: str
    created_at: float

# Dependency to get the session manager
async def get_session_manager(
    settings: Settings = Depends(lambda: Settings()),
    browser_factory: BrowserFactory = Depends(lambda: BrowserFactory(headless=not settings.debug))
) -> SessionManager:
    manager = SessionManager(settings, browser_factory)
    return manager

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate,
    manager: SessionManager = Depends(get_session_manager)
):
    """Create a new browser session"""
    session = await manager.create_session(
        name=data.name,
        browser_type=data.browser_type,
        parameters=data.parameters
    )
    return session

@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    manager: SessionManager = Depends(get_session_manager)
):
    """List all sessions"""
    return await manager.list_sessions()

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager)
):
    """Get session details"""
    session = await manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    manager: SessionManager = Depends(get_session_manager)
):
    """Delete a session"""
    success = await manager.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    return None

@router.websocket("/ws/{session_id}")
async def websocket_session_updates(
    websocket: WebSocket,
    session_id: str,
    manager: SessionManager = Depends(get_session_manager)
):
    """WebSocket for real-time session updates"""
    await websocket.accept()
    try:
        await manager.register_websocket(session_id, websocket)
        while True:
            # Keep the connection alive with periodic pings
            await asyncio.sleep(30)
            await websocket.send_text('{"type":"ping"}')
    except WebSocketDisconnect:
        await manager.unregister_websocket(session_id, websocket)