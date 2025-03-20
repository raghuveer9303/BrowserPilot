from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
import os
from ..config import Settings

router = APIRouter(prefix="/api/vnc_info", tags=["vnc"])

class VncInfoResponse(BaseModel):
    host: str
    port: int
    password: str
    width: int
    height: int

@router.get("", response_model=VncInfoResponse)
async def get_vnc_info(settings: Settings = Depends(lambda: Settings())):
    """Get VNC connection information"""
    return {
        "host": os.environ.get("HOST", "localhost"),
        "port": 5901,  # Use port 5901 consistently
        "password": settings.vnc_password,
        "width": settings.browser_width,
        "height": settings.browser_height
    }