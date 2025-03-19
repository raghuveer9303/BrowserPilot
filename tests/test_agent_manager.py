import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock
from backend.agent_manager import AgentManager
from backend.config import Settings
from backend.utils.browser_factory import BrowserFactory
from backend.utils.result_storage import ResultStorage

@pytest.fixture
def settings():
    return Settings()

@pytest.fixture
def browser_factory():
    factory = MagicMock(spec=BrowserFactory)
    factory.create_browser = AsyncMock()
    return factory

@pytest.fixture
def result_storage():
    storage = MagicMock(spec=ResultStorage)
    storage.save_result = AsyncMock()
    return storage

@pytest.fixture
def agent_manager(settings, browser_factory, result_storage):
    return AgentManager(settings, browser_factory, result_storage)

@pytest.mark.asyncio
async def test_create_task(agent_manager):
    # Arrange
    task_id = "test-task-123"
    task_info = {
        "instructions": "Search for Python",
        "url": "https://www.google.com",
        "model": "default",
        "max_steps": 5
    }
    
    # Create a patched version of _execute_task that doesn't actually run
    with patch.object(agent_manager, '_execute_task', AsyncMock()) as mock_execute:
        # Act
        result = await agent_manager.create_task(task_id, task_info)
        
        # Assert
        assert result == task_id
        assert task_id in agent_manager.tasks
        assert agent_manager.tasks[task_id]["status"] == "initializing"
        assert agent_manager.tasks[task_id]["info"] == task_info
        mock_execute.assert_called_once_with(task_id)

@pytest.mark.asyncio
async def test_get_task_status(agent_manager):
    # Arrange
    task_id = "test-task-123"
    task_info = {
        "instructions": "Search for Python",
        "url": "https://www.google.com"
    }
    
    # Create a task
    await agent_manager.create_task(task_id, task_info)
    
    # Act
    status = await agent_manager.get_task_status(task_id)
    
    # Assert
    assert status is not None
    assert status["id"] == task_id
    assert status["status"] == "initializing"
    
    # Test non-existent task
    non_existent = await agent_manager.get_task_status("non-existent")
    assert non_existent is None

@pytest.mark.asyncio
async def test_cancel_task(agent_manager):
    # Arrange
    task_id = "test-task-123"
    task_info = {
        "instructions": "Search for Python",
        "url": "https://www.google.com"
    }
    
    # Create a task and mock agent
    await agent_manager.create_task(task_id, task_info)
    mock_agent = MagicMock()
    mock_agent.stop = AsyncMock()
    agent_manager.agents[task_id] = mock_agent
    
    # Patch the _update_task_status method
    with patch.object(agent_manager, '_update_task_status', AsyncMock()) as mock_update:
        # Act
        result = await agent_manager.cancel_task(task_id)
        
        # Assert
        assert result is True
        mock_agent.stop.assert_called_once()
        mock_update.assert_called_once_with(task_id, "cancelled")
    
    # Test non-existent task
    result = await agent_manager.cancel_task("non-existent")
    assert result is False

@pytest.mark.asyncio
async def test_execute_task_success(agent_manager, browser_factory, result_storage):
    # Arrange
    task_id = "test-task-123"
    task_info = {
        "instructions": "Search for Python",
        "url": "https://www.google.com",
        "model": "default",
        "max_steps": 5,
        "parameters": {}
    }
    
    # Create a task
    await agent_manager.create_task(task_id, task_info)
    
    # Mock browser and agent
    mock_browser = AsyncMock()
    browser_factory.create_browser.return_value = mock_browser
    
    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(return_value={"result": "success"})
    mock_agent.close = AsyncMock()
    mock_agent.on_step = MagicMock()
    
    # Mock the model client
    with patch('backend.agent_manager.get_model_client', return_value=MagicMock()):
        # Mock BrowserUse creation
        with patch('backend.agent_manager.BrowserUse', return_value=mock_agent):
            # Mock update_task_status to avoid WebSocket dependencies
            with patch.object(agent_manager, '_update_task_status', AsyncMock()) as mock_update:
                with patch.object(agent_manager, '_notify_websockets', AsyncMock()) as mock_notify:
                    # Act
                    await agent_manager._execute_task(task_id)
                    
                    # Assert
                    browser_factory.create_browser.assert_called_once()
                    mock_agent.on_step.assert_called_once()
                    mock_agent.run.assert_called_once_with(
                        instructions=task_info["instructions"],
                        start_url=task_info["url"],
                        parameters=task_info["parameters"]
                    )
                    result_storage.save_result.assert_called_once_with(task_id, {"result": "success"})
                    mock_agent.close.assert_called_once()
                    assert task_id not in agent_manager.agents
                    
                    # Check status updates
                    assert mock_update.call_count == 3
                    mock_update.assert_any_call(task_id, "starting")
                    mock_update.assert_any_call(task_id, "running")
                    mock_update.assert_any_call(task_id, "completed")