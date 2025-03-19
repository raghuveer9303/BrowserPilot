from typing import Dict, List, Any, Optional
import uuid
import time
import asyncio
import logging
from fastapi import WebSocket
from browser_use import BrowserUse
from ..config import Settings
from ..utils.browser_factory import BrowserFactory
from ..model import get_model_client

logger = logging.getLogger(__name__)

class SessionManager:
    """Manages browser sessions"""
    
    def __init__(self, settings: Settings, browser_factory: BrowserFactory):
        self.settings = settings
        self.browser_factory = browser_factory
        self.sessions = {}  # session_id -> session_info
        self.websockets = {}  # session_id -> list of websockets
        self._lock = asyncio.Lock()
    
    async def create_session(self, name: Optional[str] = None, browser_type: str = "chromium", parameters: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create a new browser session"""
        async with self._lock:
            session_id = str(uuid.uuid4())
            session_name = name or f"Session {session_id[:8]}"
            
            session = {
                "id": session_id,
                "name": session_name,
                "browser_type": browser_type,
                "status": "initializing",
                "created_at": time.time(),
                "parameters": parameters or {},
            }
            
            self.sessions[session_id] = session
            
            try:
                # Create browser context for this session
                context = await self.browser_factory.create_session_browser(
                    session_id, 
                    browser_type, 
                    viewport={"width": self.settings.browser_width, "height": self.settings.browser_height}
                )
                
                # Create a new page in the context
                page = await context.new_page()
                await page.goto("about:blank")
                
                # Update session status
                session["status"] = "running"
                await self._notify_websockets(session_id, {
                    "type": "status",
                    "data": {"status": "running"}
                })
                
                logger.info(f"Created session: {session_id} ({session_name})")
                return session
            except Exception as e:
                logger.error(f"Error creating session: {str(e)}")
                session["status"] = "error"
                session["error"] = str(e)
                await self._notify_websockets(session_id, {
                    "type": "status",
                    "data": {"status": "error", "error": str(e)}
                })
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
            # Close browser context
            await self.browser_factory.close_session(session_id)
            
            # Delete session
            del self.sessions[session_id]
            
            # Notify connected clients
            await self._notify_websockets(session_id, {
                "type": "session_deleted",
                "data": {"session_id": session_id}
            })
            
            logger.info(f"Deleted session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting session {session_id}: {str(e)}")
            return False
    
    async def run_agent_task(self, session_id: str, instructions: str, model: str = "default") -> Dict[str, Any]:
        """Run an agent task on a session"""
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        # Get browser context
        context = await self.browser_factory.get_session_browser(session_id)
        if not context:
            raise ValueError(f"Browser context for session {session_id} not found")
        
        # Get the first page or create one
        pages = await context.pages()
        page = pages[0] if pages else await context.new_page()
        
        # Get model client
        model_client = get_model_client(model or self.settings.default_model)
        
        # Create BrowserUse agent
        agent = BrowserUse(
            browser=page,
            llm_client=model_client,
            max_steps=self.settings.max_task_duration
        )
        
        # Set up progress callback
        async def progress_callback(step_info):
            await self._notify_websockets(session_id, {
                "type": "step",
                "data": step_info
            })
        
        agent.on_step(progress_callback)
        
        # Run the agent
        try:
            result = await agent.run(instructions=instructions)
            return {
                "session_id": session_id,
                "status": "completed",
                "result": result
            }
        except Exception as e:
            logger.error(f"Error running agent task: {str(e)}")
            return {
                "session_id": session_id,
                "status": "error",
                "error": str(e)
            }
        finally:
            await agent.close()
    
    async def register_websocket(self, session_id: str, websocket: WebSocket):
        """Register a WebSocket for session updates"""
        if session_id not in self.websockets:
            self.websockets[session_id] = []
        self.websockets[session_id].append(websocket)
        
        # Send current status
        if session_id in self.sessions:
            await websocket.send_json({
                "type": "status",
                "data": {
                    "status": self.sessions[session_id]["status"]
                }
            })
    
    async def unregister_websocket(self, session_id: str, websocket: WebSocket):
        """Unregister a WebSocket"""
        if session_id in self.websockets and websocket in self.websockets[session_id]:
            self.websockets[session_id].remove(websocket)
            if not self.websockets[session_id]:
                del self.websockets[session_id]
    
    async def _notify_websockets(self, session_id: str, message: Dict[str, Any]):
        """Send a message to all WebSockets registered for a session"""
        if session_id in self.websockets:
            for websocket in list(self.websockets[session_id]):
                try:
                    await websocket.send_json(message)
                except Exception:
                    # Socket might be closed
                    await self.unregister_websocket(session_id, websocket)