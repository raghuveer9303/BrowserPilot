import asyncio
import time
import logging
from typing import Dict, List, Any, Optional
import uuid
from fastapi import WebSocket
from browser_use import BrowserUse
from ..config import Settings
from ..utils.browser_factory import BrowserFactory

logger = logging.getLogger(__name__)

class SessionManager:
    """Manages browser sessions"""
    
    def __init__(self, settings: Settings, browser_factory: BrowserFactory):
        self.settings = settings
        self.browser_factory = browser_factory
        self.sessions = {}  # session_id -> session_info
        self.agents = {}  # session_id -> BrowserUse agent
        self.browser_contexts = {}  # session_id -> browser context
        self.websockets = {}  # session_id -> list of websockets
        self._lock = asyncio.Lock()
    
    async def create_session(self, name: str, browser_type: str = "chromium", parameters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a new browser session"""
        async with self._lock:
            session_id = str(uuid.uuid4())
            
            session = {
                "id": session_id,
                "name": name or f"Session {session_id[:8]}",
                "browser_type": browser_type,
                "status": "initializing",
                "created_at": time.time(),
                "parameters": parameters or {},
            }
            
            self.sessions[session_id] = session
            
            try:
                # Create browser context for this session
                browser_context = await self.browser_factory.create_session_browser(session_id, browser_type)
                self.browser_contexts[session_id] = browser_context
                
                # Update session status
                session["status"] = "running"
                
                logger.info(f"Created session: {session_id} ({name})")
                return session
            except Exception as e:
                logger.error(f"Error creating session: {str(e)}")
                session["status"] = "error"
                session["error"] = str(e)
                return session
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session details"""
        return self.sessions.get(session_id)
    
    async def list_sessions(self) -> List[Dict[str, Any]]:
        """List all sessions"""
        return list(self.sessions.values())
    
    async def delete_session(self, session_id: str) -> bool:
        """Delete a session"""
        if session_id not in self.sessions:
            return False
        
        try:
            # Close browser context if exists
            if session_id in self.browser_contexts:
                await self.browser_factory.close_session(session_id)
                del self.browser_contexts[session_id]
            
            # Stop agent if running
            if session_id in self.agents:
                agent = self.agents[session_id]
                await agent.close()
                del self.agents[session_id]
            
            # Delete session
            del self.sessions[session_id]
            
            logger.info(f"Deleted session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting session {session_id}: {str(e)}")
            return False
    
    async def create_agent(self, session_id: str, model: str = "default") -> Optional[BrowserUse]:
        """Create a BrowserUse agent for a session"""
        if session_id not in self.sessions or session_id not in self.browser_contexts:
            return None
        
        from ..model import get_model_client
        
        try:
            # Get model client
            model_client = get_model_client(model)
            
            # Get browser context
            browser_context = self.browser_contexts[session_id]
            
            # Create agent with the first page in the context
            pages = await browser_context.pages()
            if not pages:
                page = await browser_context.new_page()
            else:
                page = pages[0]
            
            # Create BrowserUse agent
            agent = BrowserUse(
                browser=page,
                llm_client=model_client,
                max_steps=self.settings.max_task_duration
            )
            
            self.agents[session_id] = agent
            logger.info(f"Created agent for session: {session_id}")
            
            return agent
        except Exception as e:
            logger.error(f"Error creating agent for session {session_id}: {str(e)}")
            return None
    
    async def run_agent_instruction(self, session_id: str, instructions: str, url: Optional[str] = None, parameters: Dict[str, Any] = None) -> Any:
        """Run an instruction on a session's agent"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        # Get or create agent
        agent = self.agents.get(session_id)
        if not agent:
            agent = await self.create_agent(session_id)
            if not agent:
                raise ValueError(f"Failed to create agent for session {session_id}")
        
        # Run instruction
        start_url = url or "about:blank"
        result = await agent.run(
            instructions=instructions,
            start_url=start_url,
            parameters=parameters or {}
        )
        
        return result
    
    async def register_websocket(self, session_id: str, websocket: WebSocket):
        """Register a WebSocket for session updates"""
        if session_id not in self.websockets:
            self.websockets[session_id] = []
        self.websockets[session_id].append(websocket)
        
        # Send current status immediately
        if session_id in self.sessions:
            session = self.sessions[session_id]
            await websocket.send_json({
                "type": "status",
                "data": {
                    "status": session["status"],
                    "name": session["name"]
                }
            })
    
    async def unregister_websocket(self, session_id: str, websocket: WebSocket):
        """Unregister a WebSocket from session updates"""
        if session_id in self.websockets and websocket in self.websockets[session_id]:
            self.websockets[session_id].remove(websocket)
            if not self.websockets[session_id]:
                del self.websockets[session_id]
    
    async def notify_websockets(self, session_id: str, message: Dict[str, Any]):
        """Send a message to all WebSockets registered for a session"""
        if session_id in self.websockets:
            for websocket in self.websockets[session_id]:
                try:
                    await websocket.send_json(message)
                except Exception:
                    # Socket might be closed
                    pass