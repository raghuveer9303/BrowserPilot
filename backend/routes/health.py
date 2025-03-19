from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any
import os
import time
import platform
from ..config import Settings

router = APIRouter(prefix="/api/health", tags=["health"])

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: float
    system_info: Dict[str, Any]

class HealthDetailResponse(HealthResponse):
    services: Dict[str, Dict[str, Any]]
    config: Dict[str, Any]

def get_version() -> str:
    """Get the application version"""
    try:
        with open("VERSION", "r") as f:
            return f.read().strip()
    except Exception:
        return "dev"

@router.get("", response_model=HealthResponse)
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "ok",
        "version": get_version(),
        "timestamp": time.time(),
        "system_info": {
            "platform": platform.system(),
            "python_version": platform.python_version()
        }
    }

@router.get("/detail", response_model=HealthDetailResponse)
async def health_check_detail(settings: Settings = Depends(lambda: Settings())):
    """Detailed health check with service status"""
    # Check browser service
    browser_status = {"status": "unknown"}
    try:
        # Just check if playwright is installed
        import playwright
        browser_status = {
            "status": "ok",
            "version": playwright.__version__
        }
    except ImportError:
        browser_status = {
            "status": "error",
            "message": "Playwright not installed"
        }
    except Exception as e:
        browser_status = {
            "status": "error",
            "message": str(e)
        }
    
    # Check VNC service
    vnc_status = {"status": "unknown"}
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        result = s.connect_ex(('localhost', settings.vnc_port))
        s.close()
        
        if result == 0:
            vnc_status = {"status": "ok"}
        else:
            vnc_status = {
                "status": "error",
                "message": f"VNC not available on port {settings.vnc_port}"
            }
    except Exception as e:
        vnc_status = {
            "status": "error",
            "message": str(e)
        }
    
    # Check noVNC service
    novnc_status = {"status": "unknown"}
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        result = s.connect_ex(('localhost', settings.novnc_port))
        s.close()
        
        if result == 0:
            novnc_status = {"status": "ok"}
        else:
            novnc_status = {
                "status": "error",
                "message": f"noVNC not available on port {settings.novnc_port}"
            }
    except Exception as e:
        novnc_status = {
            "status": "error",
            "message": str(e)
        }
    
    # Filter sensitive config values
    filtered_config = {
        "debug": settings.debug,
        "browser_width": settings.browser_width,
        "browser_height": settings.browser_height,
        "default_model": settings.default_model,
        "has_anthropic_key": bool(settings.anthropic_api_key),
        "has_openai_key": bool(settings.openai_api_key),
        "has_gemini_key": bool(settings.gemini_api_key)
    }
    
    return {
        "status": "ok",
        "version": get_version(),
        "timestamp": time.time(),
        "system_info": {
            "platform": platform.system(),
            "python_version": platform.python_version(),
            "hostname": platform.node(),
            "cpu_count": os.cpu_count()
        },
        "services": {
            "browser": browser_status,
            "vnc": vnc_status,
            "novnc": novnc_status
        },
        "config": filtered_config
    }