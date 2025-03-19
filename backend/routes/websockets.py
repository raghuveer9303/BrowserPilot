from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List, Any
import json
import asyncio
import logging
from ..config import Settings

router = APIRouter(tags=["websockets"])

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        if client_id not in self.active_connections:
            self.active_connections[client_id] = []
        self.active_connections[client_id].append(websocket)
        logger.info(f"Client {client_id} connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket, client_id: str):
        if client_id in self.active_connections:
            if websocket in self.active_connections[client_id]:
                self.active_connections[client_id].remove(websocket)
            if not self.active_connections[client_id]:
                del self.active_connections[client_id]
        logger.info(f"Client {client_id} disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_message(self, message: Any, client_id: str):
        if client_id in self.active_connections:
            if isinstance(message, str):
                message_str = message
            else:
                message_str = json.dumps(message)
            
            dead_websockets = []
            for websocket in self.active_connections[client_id]:
                try:
                    await websocket.send_text(message_str)
                except Exception as e:
                    logger.error(f"Error sending message to client {client_id}: {str(e)}")
                    dead_websockets.append(websocket)
            
            # Clean up dead connections
            for websocket in dead_websockets:
                self.disconnect(websocket, client_id)
    
    async def broadcast(self, message: Any):
        if isinstance(message, str):
            message_str = message
        else:
            message_str = json.dumps(message)
        
        for client_id in list(self.active_connections.keys()):
            await self.send_message(message_str, client_id)
    
    def get_client_count(self):
        return len(self.active_connections)

# Create a singleton connection manager
manager = ConnectionManager()

@router.websocket("/ws/browser/{client_id}")
async def websocket_browser_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket for browser events and updates"""
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == "browser_event":
                    # Forward browser events to all clients with same ID
                    await manager.send_message(message, client_id)
                elif message.get("type") == "ping":
                    # Respond to ping messages
                    await websocket.send_text(json.dumps({"type": "pong"}))
                else:
                    # Echo any other message
                    await websocket.send_text(data)
            except json.JSONDecodeError:
                logger.warning(f"Received invalid JSON from client {client_id}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "error": "Invalid JSON received"
                }))
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id)
    except Exception as e:
        logger.exception(f"Error in websocket connection with client {client_id}: {str(e)}")
        manager.disconnect(websocket, client_id)

@router.websocket("/ws/notify")
async def websocket_notification_endpoint(websocket: WebSocket):
    """WebSocket for system-wide notifications"""
    # Use a global ID for broadcast messages
    broadcast_id = "broadcast"
    await manager.connect(websocket, broadcast_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                
                # Only admin messages can be broadcast
                if message.get("type") == "admin_broadcast":
                    await manager.broadcast({
                        "type": "notification",
                        "message": message.get("message", ""),
                        "level": message.get("level", "info")
                    })
                    await websocket.send_text(json.dumps({
                        "type": "broadcast_sent",
                        "recipients": manager.get_client_count()
                    }))
                else:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "error": "Unauthorized broadcast attempt"
                    }))
            except json.JSONDecodeError:
                logger.warning("Received invalid JSON in broadcast websocket")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "error": "Invalid JSON received"
                }))
    except WebSocketDisconnect:
        manager.disconnect(websocket, broadcast_id)
    except Exception as e:
        logger.exception(f"Error in broadcast websocket: {str(e)}")
        manager.disconnect(websocket, broadcast_id)