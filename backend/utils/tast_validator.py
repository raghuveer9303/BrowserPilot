from typing import Dict, Any, List, Tuple, Optional
import re
import logging

logger = logging.getLogger(__name__)

class TaskValidator:
    """Validates task configurations and parameters"""
    
    def __init__(self, max_steps: int = 50, max_instruction_length: int = 2000):
        self.max_steps = max_steps
        self.max_instruction_length = max_instruction_length
        
    def validate_task(self, task_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Validate task data
        
        Args:
            task_data: The task configuration to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check for required fields
        if 'instructions' not in task_data:
            return False, "Missing required field: instructions"
        
        # Validate instructions
        instructions = task_data.get('instructions', '')
        if not instructions:
            return False, "Instructions cannot be empty"
        
        if len(instructions) > self.max_instruction_length:
            return False, f"Instructions too long (max {self.max_instruction_length} characters)"
        
        # Validate URL if provided
        url = task_data.get('url')
        if url and not self._is_valid_url(url):
            return False, "Invalid URL format"
        
        # Validate max_steps
        max_steps = task_data.get('max_steps', 10)
        if not isinstance(max_steps, int) or max_steps < 1 or max_steps > self.max_steps:
            return False, f"max_steps must be between 1 and {self.max_steps}"
        
        # Validate model
        model = task_data.get('model', 'default')
        if not self._is_valid_model(model):
            return False, f"Unsupported model: {model}"
        
        # Validate parameters if provided
        parameters = task_data.get('parameters', {})
        if not isinstance(parameters, dict):
            return False, "parameters must be an object"
        
        return True, None
    
    def _is_valid_url(self, url: str) -> bool:
        """
        Check if a URL is valid
        
        Args:
            url: The URL to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not url:
            return True  # Empty URL is valid (will use default)
            
        # Simple URL validation
        url_pattern = re.compile(
            r'^(https?:\/\/)?' # http:// or https://
            r'([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}' # domain
            r'(:\d+)?' # optional port
            r'(\/[^\/\s]*)?' # optional path
            r'$'
        )
        
        return bool(url_pattern.match(url))
    
    def _is_valid_model(self, model: str) -> bool:
        """
        Check if a model name is valid
        
        Args:
            model: The model name to validate
            
        Returns:
            True if valid, False otherwise
        """
        valid_models = [
            'default', 
            'openai', 'gpt-4', 'gpt-3.5-turbo',
            'anthropic', 'claude',
            'gemini'
        ]
        
        return model.lower() in valid_models