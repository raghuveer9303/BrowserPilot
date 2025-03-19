"""API routes for BrowserPilot"""

from .sessions import router as sessions_router
from .tasks import router as tasks_router
from .websockets import router as websockets_router
from .health import router as health_router
from .browser import router as browser_router

# List all routers to be included in the app
routers = [
    sessions_router,
    tasks_router,
    websockets_router,
    health_router,
    browser_router
]