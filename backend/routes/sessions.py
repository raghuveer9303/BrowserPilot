from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid
from ..config import Settings

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

class SessionManager:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.sessions = {}
    
    async def create_session(self, data: SessionCreate) -> SessionResponse:
        """Create a new browser session"""
        session_id = str(uuid.uuid4())
        name = data.name or f"Session {session_id[:8]}"
        
        import time
        session = {
            "id": session_id,
            "name": name,
            "browser_type": data.browser_type,
            "status": "initializing",
            "created_at": time.time(),
            "parameters": data.parameters,
        }
        
        self.sessions[session_id] = session
        
        # This would actually initialize the browser session in a real implementation
        
        return SessionResponse(**session)
    
    async def get_session(self, session_id: str) -> Optional[SessionResponse]:
        """Get session details"""
        if session_id not in self.sessions:
            return None
        
        return SessionResponse(**self.sessions[session_id])
    
    async def list_sessions(self) -> List[SessionResponse]:
        """List all sessions"""
        return [SessionResponse(**session) for session in self.sessions.values()]
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        if session_id not in self.sessions:
            return False
        
        del self.sessions[session_id]
        return True

def get_session_manager(settings: Settings = Depends(lambda: Settings())):
    return SessionManager(settings)

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    data: SessionCreate,
    manager: SessionManager = Depends(get_session_manager)
):
    """Create a new browser session"""
    session = await manager.create_session(data)
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