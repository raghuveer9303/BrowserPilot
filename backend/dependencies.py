from .config import Settings
from .utils.browser_factory import BrowserFactory
from .utils.result_storage import ResultStorage
from .agent_manager import AgentManager

_settings = Settings()
# Fix: pass a boolean for headless instead of Settings
_browser_factory = BrowserFactory(headless=not _settings.debug)
_result_storage = ResultStorage(_settings.result_storage_path)
_agent_manager = AgentManager(_settings, _browser_factory, _result_storage)

def get_agent_manager():
    return _agent_manager