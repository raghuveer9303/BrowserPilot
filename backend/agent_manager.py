import asyncio
from fastapi import WebSocket
from typing import Dict, List, Any, Optional
import time
import logging
from browser_use import Agent as BrowserUse
from .model import get_model_client
from .config import Settings
from .utils.browser_factory import BrowserFactory
from .utils.result_storage import ResultStorage

logger = logging.getLogger(__name__)

class AgentManager:
    """Manages browser agents and their associated tasks"""
    
    def __init__(self, settings: Settings, browser_factory: BrowserFactory, result_storage: ResultStorage):
        self.settings = settings
        self.browser_factory = browser_factory
        self.result_storage = result_storage
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.websockets: Dict[str, List[WebSocket]] = {}
        self.agents = {}
        self.tasks_lock = asyncio.Lock()

    async def create_task(self, task_id: str, task_data: Dict[str, Any]) -> None:
        """Create a new task and initialize its status."""
        self.tasks[task_id] = {
            "id": task_id,
            "status": "initializing",
            "created_at": time.time(),
            "info": task_data,  # Add the 'info' field to store task details
            "steps": [],
            "result": None,
            "error": None,
        }
        # Start task execution in the background
        asyncio.create_task(self._execute_task(task_id))

    async def _execute_task(self, task_id: str):
        """Execute a browser task"""
        task = self.tasks[task_id]
        task_info = task["info"]
        
        try:
            # Update status
            await self._update_task_status(task_id, "starting")
            
            # Get model client
            model_client = get_model_client(task_info["model"])  # Use key-based access for 'model'
            
            # Launch browser
            browser = await self.browser_factory.create_browser()
            
            # Create a BrowserUse agent
            agent = BrowserUse(
                browser=browser,
                llm_client=model_client,
                max_steps=task_info.get("max_steps", 10) # Use key-based access for 'max_steps'
            )
            
            self.agents[task_id] = agent
            
            # Update status
            await self._update_task_status(task_id, "running")
            
            # Set up progress callback
            async def progress_callback(step_info):
                task["steps"].append(step_info)
                await self._notify_websockets(task_id, {
                    "type": "step",
                    "data": step_info
                })
            
            agent.on_step(progress_callback)
            
            # Start the task
            start_url = task_info.url or "about:blank"
            result = await agent.run(
                instructions=task_info.instructions,
                start_url=start_url,
                parameters=task_info.parameters
            )
            
            # Save result
            await self.result_storage.save_result(task_id, result)
            task["result"] = result
            
            # Update status
            await self._update_task_status(task_id, "completed")
            
        except Exception as e:
            logger.exception(f"Error executing task {task_id}: {str(e)}")
            task["error"] = str(e)
            await self._update_task_status(task_id, "error")
        finally:
            # Clean up
            if task_id in self.agents:
                agent = self.agents[task_id]
                await agent.close()
                del self.agents[task_id]

    async def get_task_status(self, task_id: str) -> Optional[dict]:
        """Get the current status of a task"""
        if task_id not in self.tasks:
            return None
        
        task = self.tasks[task_id]
        return {
            "id": task_id,
            "status": task["status"],
            "created_at": task["created_at"],
            "steps": task["steps"],
            "result": task["result"],
            "error": task.get("error")
        }

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a running task"""
        if task_id not in self.tasks or task_id not in self.agents:
            return False
        
        agent = self.agents[task_id]
        await agent.stop()
        await self._update_task_status(task_id, "cancelled")
        return True

    async def _update_task_status(self, task_id: str, status: str):
        """Update task status and notify connected clients"""
        if task_id in self.tasks:
            self.tasks[task_id]["status"] = status
            await self._notify_websockets(task_id, {
                "type": "status",
                "data": {"status": status}
            })

    async def register_websocket(self, task_id: str, websocket: WebSocket):
        """Register a WebSocket for task updates"""
        if task_id not in self.websockets:
            self.websockets[task_id] = []
        self.websockets[task_id].append(websocket)
        
        # Send current status immediately
        if task_id in self.tasks:
            task = self.tasks[task_id]
            await websocket.send_json({
                "type": "status",
                "data": {
                    "status": task["status"],
                    "steps": task["steps"]
                }
            })

    async def unregister_websocket(self, task_id: str, websocket: WebSocket):
        """Unregister a WebSocket from task updates"""
        if task_id in self.websockets and websocket in self.websockets[task_id]:
            self.websockets[task_id].remove(websocket)
            if not self.websockets[task_id]:
                del self.websockets[task_id]

    async def _notify_websockets(self, task_id: str, message: dict):
        """Send a message to all WebSockets registered for a task"""
        if task_id in self.websockets:
            for websocket in self.websockets[task_id]:
                try:
                    await websocket.send_json(message)
                except Exception:
                    # Socket might be closed
                    pass