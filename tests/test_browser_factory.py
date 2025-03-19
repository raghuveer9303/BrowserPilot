import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.utils.browser_factory import BrowserFactory

@pytest.mark.asyncio
async def test_initialize():
    # Arrange
    mock_playwright = AsyncMock()
    factory = BrowserFactory(headless=True)
    
    # Act
    with patch('backend.utils.browser_factory.async_playwright', return_value=mock_playwright):
        await factory.initialize()
        
        # Assert
        mock_playwright.start.assert_called_once()
        assert factory._initialized is True
        
        # Call initialize again, should not initialize twice
        await factory.initialize()
        assert mock_playwright.start.call_count == 1

@pytest.mark.asyncio
async def test_create_browser_chromium():
    # Arrange
    factory = BrowserFactory(headless=True)
    mock_playwright = AsyncMock()
    mock_browser = AsyncMock()
    mock_context = AsyncMock()
    
    mock_playwright.chromium = MagicMock()
    mock_playwright.chromium.launch = AsyncMock(return_value=mock_browser)
    mock_browser.new_context = AsyncMock(return_value=mock_context)
    
    # Act
    with patch('backend.utils.browser_factory.async_playwright', return_value=mock_playwright):
        # Initialize first
        await factory.initialize()
        
        # Create browser
        context = await factory.create_browser(browser_type="chromium")
        
        # Assert
        mock_playwright.chromium.launch.assert_called_once()
        mock_browser.new_context.assert_called_once()
        assert context == mock_context

@pytest.mark.asyncio
async def test_create_browser_firefox():
    # Arrange
    factory = BrowserFactory(headless=True)
    mock_playwright = AsyncMock()
    mock_browser = AsyncMock()
    mock_context = AsyncMock()
    
    mock_playwright.firefox = MagicMock()
    mock_playwright.firefox.launch = AsyncMock(return_value=mock_browser)
    mock_browser.new_context = AsyncMock(return_value=mock_context)
    
    # Act
    with patch('backend.utils.browser_factory.async_playwright', return_value=mock_playwright):
        # Initialize first
        await factory.initialize()
        
        # Create browser
        context = await factory.create_browser(browser_type="firefox")
        
        # Assert
        mock_playwright.firefox.launch.assert_called_once()
        mock_browser.new_context.assert_called_once()
        assert context == mock_context

@pytest.mark.asyncio
async def test_close():
    # Arrange
    factory = BrowserFactory(headless=True)
    mock_playwright = AsyncMock()
    mock_browser = AsyncMock()
    
    factory._initialized = True
    factory.playwright = mock_playwright
    factory.browser = mock_browser
    
    # Act
    await factory.close()
    
    # Assert
    mock_browser.close.assert_called_once()
    mock_playwright.stop.assert_called_once()
    assert factory._initialized is False
    assert factory.browser is None
    assert factory.playwright is None