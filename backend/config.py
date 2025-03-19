from pydantic_settings import BaseSettings
from typing import Optional, Dict, Any, List
import os

class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    
    # VNC settings
    vnc_port: int = 5900
    novnc_port: int = 6080
    vnc_password: str = "password"
    
    # Browser settings
    browser_width: int = 1280
    browser_height: int = 720
    browser_timeout: int = 30000  # milliseconds
    
    # Model settings
    default_model: str = "openai"
    anthropic_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    
    # Task settings
    max_task_duration: int = 300  # seconds
    result_storage_path: str = "./results"
    
    # Auth settings (optional for future use)
    api_key: Optional[str] = None
    
    model_config = {
        'env_file': '.env',
        'case_sensitive': False
    }