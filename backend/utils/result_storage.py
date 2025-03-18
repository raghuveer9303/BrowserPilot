import os
import json
import asyncio
from typing import Dict, Any, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class ResultStorage:
    """Storage for task results"""
    
    def __init__(self, storage_path: str = "./results"):
        self.storage_path = storage_path
        self._lock = asyncio.Lock()
        self._ensure_storage_dir()
    
    def _ensure_storage_dir(self):
        """Ensure the storage directory exists"""
        os.makedirs(self.storage_path, exist_ok=True)
    
    async def save_result(self, task_id: str, result: Any) -> str:
        """Save task result to storage"""
        async with self._lock:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{task_id}_{timestamp}.json"
            filepath = os.path.join(self.storage_path, filename)
            
            with open(filepath, "w") as f:
                json.dump({
                    "task_id": task_id,
                    "timestamp": timestamp,
                    "result": result
                }, f, indent=2)
                
            return filepath
    
    async def get_result(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get saved result for a task"""
        files = os.listdir(self.storage_path)
        matching_files = [f for f in files if f.startswith(f"{task_id}_")]
        
        if not matching_files:
            return None
            
        # Get the most recent file
        latest_file = sorted(matching_files)[-1]
        filepath = os.path.join(self.storage_path, latest_file)
        
        with open(filepath, "r") as f:
            return json.load(f)
    
    async def list_results(self, limit: int = 100, offset: int = 0) -> list:
        """List saved results with pagination"""
        files = os.listdir(self.storage_path)
        json_files = [f for f in files if f.endswith(".json")]
        
        # Sort by timestamp (descending)
        sorted_files = sorted(json_files, reverse=True)
        paginated_files = sorted_files[offset:offset+limit]
        
        results = []
        for filename in paginated_files:
            filepath = os.path.join(self.storage_path, filename)
            with open(filepath, "r") as f:
                results.append(json.load(f))
                
        return results
    
    async def delete_result(self, task_id: str) -> bool:
        """Delete saved result for a task"""
        files = os.listdir(self.storage_path)
        matching_files = [f for f in files if f.startswith(f"{task_id}_")]
        
        if not matching_files:
            return False
            
        for filename in matching_files:
            filepath = os.path.join(self.storage_path, filename)
            os.remove(filepath)
            
        return True