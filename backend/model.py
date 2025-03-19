from typing import Optional, Dict, Any, Callable, List
import os
import json
import requests
from abc import ABC, abstractmethod

class LLMClient(ABC):
    """Abstract base class for LLM clients"""
    
    @abstractmethod
    async def generate(self, prompt: str, system: Optional[str] = None, **kwargs) -> str:
        """Generate a response from the LLM"""
        pass

class AnthropicClient(LLMClient):
    """Client for Anthropic Claude"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "claude-3-opus-20240229"):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("Anthropic API key is required")
        self.model = model
        self.base_url = "https://api.anthropic.com/v1/messages"
        
    async def generate(self, prompt: str, system: Optional[str] = None, **kwargs) -> str:
        """Generate a response from Claude"""
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        
        data = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": kwargs.get("max_tokens", 4000)
        }
        
        if system:
            data["system"] = system
            
        response = requests.post(self.base_url, headers=headers, json=data)
        response.raise_for_status()
        
        result = response.json()
        return result["content"][0]["text"]

class OpenAIClient(LLMClient):
    """Client for OpenAI models"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4"):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
        self.model = model
        self.base_url = "https://api.openai.com/v1/chat/completions"
        
    async def generate(self, prompt: str, system: Optional[str] = None, **kwargs) -> str:
        """Generate a response from OpenAI"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        
        data = {
            "model": self.model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 4000)
        }
        
        response = requests.post(self.base_url, headers=headers, json=data)
        response.raise_for_status()
        
        result = response.json()
        return result["choices"][0]["message"]["content"]

class GeminiClient(LLMClient):
    """Client for Google Gemini models"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-pro"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("Gemini API key is required")
        self.model = model
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        
    async def generate(self, prompt: str, system: Optional[str] = None, **kwargs) -> str:
        """Generate a response from Gemini"""
        headers = {
            "Content-Type": "application/json"
        }
        
        data = {
            "contents": [{"parts": [{"text": prompt}]}],
        }
        
        # Add system prompt if provided
        if system:
            data["systemInstruction"] = {"parts": [{"text": system}]}
            
        url = f"{self.base_url}?key={self.api_key}"
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        
        result = response.json()
        return result["candidates"][0]["content"]["parts"][0]["text"]

def get_model_client(model_name: str = "default") -> LLMClient:
    """Factory function to get a model client based on configuration"""
    model_mapping = {
        "default": "gemini",  # Default to Gemini Flash
        "anthropic": "anthropic",
        "claude": "anthropic",
        "openai": "openai",
        "gpt-4": "openai",
        "gemini": "gemini"
    }
    
    provider = model_mapping.get(model_name.lower(), "gemini")
    
    if provider == "anthropic":
        return AnthropicClient()
    elif provider == "gemini":
        return GeminiClient(api_key="AIzaSyBPS3MblzMA0tK1_h7aOFOKKJvaO1NOqqc", model="gemini-2.0-flash")
    else:  # Default to OpenAI
        return OpenAIClient(model="gpt-4" if model_name == "gpt-4" else "gpt-3.5-turbo")