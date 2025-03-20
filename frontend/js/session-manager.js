/**
 * BrowserPilot Session Management
 * Main functionality for browser control
 */

// Global state
let currentSessionId = null;
let activeWebSocket = null;

// DOM elements
const sessionForm = document.getElementById('sessionForm');
const sessionList = document.getElementById('sessionList');
const browserView = document.getElementById('browserView');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const currentSessionTitle = document.getElementById('currentSessionTitle');
const instructionsForm = document.getElementById('instructionsForm');
const statusBadge = document.getElementById('statusBadge');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// Initialize on page load
document.addEventListener('DOMContentLoaded', initApp);

/**
 * Initialize the application
 */
function initApp() {
    // Add event listeners
    sessionForm.addEventListener('submit', createSession);
    instructionsForm.addEventListener('submit', runAgentTask);
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Load existing sessions
    loadSessions();
    
    // Set up VNC info
    setupVncInfo();
}

/**
 * Load existing sessions from API
 */
async function loadSessions() {
    try {
        const response = await fetch('/api/sessions');
        if (!response.ok) throw new Error('Failed to fetch sessions');
        
        const sessions = await response.json();
        updateSessionList(sessions);
    } catch (error) {
        console.error('Error loading sessions:', error);
        showNotification('Failed to load sessions', 'error');
    }
}

/**
 * Update the session list in the UI
 */
function updateSessionList(sessions) {
    // Clear current list
    sessionList.innerHTML = '';
    
    if (sessions.length === 0) {
        sessionList.innerHTML = '<div class="text-gray-500 text-center py-4">No active sessions</div>';
        return;
    }
    
    // Add each session
    sessions.forEach(session => {
        const sessionElement = document.createElement('div');
        sessionElement.className = 'bg-white rounded-md shadow-sm p-3 mb-3';
        sessionElement.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="font-medium">${session.name}</span>
                <span class="px-2 py-1 text-xs rounded-full ${getStatusClass(session.status)}">${session.status}</span>
            </div>
            <div class="flex space-x-2">
                <button class="connect-btn flex-1 py-1 px-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded" data-id="${session.id}">
                    Connect
                </button>
                <button class="delete-btn flex-1 py-1 px-2 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded" data-id="${session.id}">
                    Delete
                </button>
            </div>
        `;
        
        // Add event listeners
        sessionElement.querySelector('.connect-btn').addEventListener('click', () => connectToSession(session.id));
        sessionElement.querySelector('.delete-btn').addEventListener('click', () => deleteSession(session.id));
        
        sessionList.appendChild(sessionElement);
    });
}

/**
 * Get CSS class for status badge
 */
function getStatusClass(status) {
    switch (status) {
        case 'running':
            return 'bg-green-100 text-green-800';
        case 'initializing':
            return 'bg-blue-100 text-blue-800';
        case 'error':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Create a new session
 */
async function createSession(event) {
    event.preventDefault();
    
    const formData = new FormData(sessionForm);
    const sessionName = formData.get('sessionName') || 'New Session';
    const browserType = formData.get('browserType');
    
    // Show loading state
    const submitBtn = sessionForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
    
    try {
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: sessionName,
                browser_type: browserType
            })
        });
        
        if (!response.ok) throw new Error('Failed to create session');
        
        const session = await response.json();
        showNotification(`Session "${session.name}" created successfully`, 'success');
        
        // Refresh session list
        loadSessions();
        
        // Connect to the new session
        connectToSession(session.id);
        
        // Reset form
        sessionForm.reset();
    } catch (error) {
        console.error('Error creating session:', error);
        showNotification('Failed to create session', 'error');
    } finally {
        // Reset button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

/**
 * Connect to a session
 */
async function connectToSession(sessionId) {
    // Disconnect from any existing session
    if (currentSessionId) {
        disconnectFromSession();
    }
    
    currentSessionId = sessionId;
    
    try {
        // Get session details
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session details');
        
        const session = await response.json();
        
        // Update UI
        currentSessionTitle.textContent = `Session: ${session.name}`;
        statusBadge.textContent = session.status;
        statusBadge.className = `px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(session.status)}`;
        
        // Enable controls
        document.getElementById('instructionsInput').disabled = false;
        document.getElementById('runAgentBtn').disabled = false;
        
        // Show loading state for VNC
        loadingOverlay.style.display = 'flex';
        loadingText.textContent = 'Connecting to browser...';
        
        // Connect WebSocket for real-time updates
        connectWebSocket(sessionId);
        
        // Connect to VNC
        connectToVnc();
    } catch (error) {
        console.error('Error connecting to session:', error);
        showNotification('Failed to connect to session', 'error');
    }
}

/**
 * Disconnect from the current session
 */
function disconnectFromSession() {
    // Close WebSocket
    if (activeWebSocket) {
        activeWebSocket.close();
        activeWebSocket = null;
    }
    
    // Reset UI
    currentSessionTitle.textContent = 'Browser View';
    statusBadge.textContent = 'No active session';
    statusBadge.className = 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800';
    
    // Disable controls
    document.getElementById('instructionsInput').disabled = true;
    document.getElementById('runAgentBtn').disabled = true;
    
    // Reset browser view
    browserView.src = 'about:blank';
    loadingOverlay.style.display = 'flex';
    loadingText.textContent = 'No active session';
    
    currentSessionId = null;
}

/**
 * Connect WebSocket for real-time session updates
 */
function connectWebSocket(sessionId) {
    if (activeWebSocket) {
        activeWebSocket.close();
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/sessions/ws/${sessionId}`;
    
    activeWebSocket = new WebSocket(wsUrl);
    
    activeWebSocket.onopen = () => {
        console.log(`WebSocket connected for session ${sessionId}`);
    };
    
    activeWebSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'status') {
                statusBadge.textContent = data.data.status;
                statusBadge.className = `px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(data.data.status)}`;
            } else if (data.type === 'step') {
                // Handle agent step update
                appendAgentLog(data.data);
            } else if (data.type === 'session_deleted' && data.data.session_id === currentSessionId) {
                // Handle session deletion
                disconnectFromSession();
                showNotification('Session has been deleted', 'info');
            } else if (data.type === 'ping') {
                // Just a keepalive message
                console.log('Ping received');
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    activeWebSocket.onclose = () => {
        console.log(`WebSocket disconnected for session ${sessionId}`);
    };
    
    activeWebSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

/**
 * Append agent log to the UI
 */
function appendAgentLog(stepData) {
    const logContainer = document.getElementById('agentLog');
    
    // Create log entry
    const logEntry = document.createElement('div');
    logEntry.className = 'bg-gray-50 border border-gray-200 rounded-md p-3 mb-3';
    
    const stepTime = new Date().toLocaleTimeString();
    
    logEntry.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <span class="font-medium text-sm">${stepData.action || 'Action'}</span>
            <span class="text-xs text-gray-500">${stepTime}</span>
        </div>
        <p class="text-sm text-gray-600 mb-2">${stepData.description || 'No description'}</p>
        ${stepData.screenshot ? `<img src="data:image/png;base64,${stepData.screenshot}" class="w-full h-auto rounded border border-gray-200" alt="Screenshot">` : ''}
    `;
    
    // Add to log container
    if (logContainer.querySelector('.text-center')) {
        logContainer.innerHTML = '';
    }
    
    logContainer.appendChild(logEntry);
    
    // Scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * Delete a session
 */
async function deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete session');
        
        showNotification('Session deleted successfully', 'success');
        
        // Disconnect if this is the current session
        if (sessionId === currentSessionId) {
            disconnectFromSession();
        }
        
        // Refresh session list
        loadSessions();
    } catch (error) {
        console.error('Error deleting session:', error);
        showNotification('Failed to delete session', 'error');
    }
}

/**
 * Run an agent task
 */
async function runAgentTask(event) {
    event.preventDefault();
    
    if (!currentSessionId) {
        showNotification('No active session', 'error');
        return;
    }
    
    const instructions = document.getElementById('instructionsInput').value.trim();
    if (!instructions) {
        showNotification('Please enter instructions for the agent', 'error');
        return;
    }
    
    // Show loading state
    const runBtn = document.getElementById('runAgentBtn');
    const originalText = runBtn.textContent;
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';
    
    // Clear previous log
    document.getElementById('agentLog').innerHTML = '<div class="text-blue-600 text-center py-4">Agent starting...</div>';
    
    try {
        const response = await fetch(`/api/sessions/${currentSessionId}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instructions: instructions
            })
        });
        
        if (!response.ok) throw new Error('Failed to run agent task');
        
        const task = await response.json();
        showNotification('Agent task started', 'success');
    } catch (error) {
        console.error('Error running agent task:', error);
        showNotification('Failed to run agent task', 'error');
        
        // Reset the agent log
        document.getElementById('agentLog').innerHTML = '<div class="text-red-600 text-center py-4">Failed to start agent</div>';
    } finally {
        // Reset button after a short delay
        setTimeout(() => {
            runBtn.disabled = false;
            runBtn.textContent = originalText;
        }, 2000);
    }
}

/**
 * Set up VNC connection info
 */
async function setupVncInfo() {
    try {
        const response = await fetch('/api/vnc_info');
        if (!response.ok) throw new Error('Failed to get VNC info');
        
        const data = await response.json();
        
        // Store VNC info for later use
        window.vncInfo = data;
    } catch (error) {
        console.error('Error getting VNC info:', error);
    }
}

/**
 * Connect to VNC
 */
function connectToVnc() {
    if (!window.vncInfo) {
        // Try to get VNC info again
        setupVncInfo().then(() => {
            if (window.vncInfo) {
                setupVncViewer();
            } else {
                loadingText.textContent = 'Failed to connect to VNC';
            }
        });
        return;
    }
    
    setupVncViewer();
}

/**
 * Set up VNC viewer
 */
function setupVncViewer() {
    const vncInfo = window.vncInfo;
    const host = window.location.hostname;
    const port = vncInfo.port || 6080;
    const password = encodeURIComponent(vncInfo.password || 'browserpilot');
    
    // Create VNC URL
    const vncUrl = `/novnc/vnc.html?host=${host}&port=5901&password=${password}&autoconnect=true&resize=scale`;
    
    // Set iframe source
    browserView.src = vncUrl;
    
    // Hide loading overlay when iframe loads
    browserView.onload = () => {
        loadingOverlay.style.display = 'none';
    };
}

/**
 * Toggle fullscreen mode
 */
function toggleFullscreen() {
    const container = document.getElementById('browserContainer');
    
    if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
            container.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

/**
 * Show a notification
 */
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'px-4 py-3 rounded-lg shadow-lg max-w-md transform transition-opacity duration-300';
    
    // Set style based on type
    switch (type) {
        case 'success':
            notification.classList.add('bg-green-50', 'text-green-800', 'border', 'border-green-200');
            break;
        case 'error':
            notification.classList.add('bg-red-50', 'text-red-800', 'border', 'border-red-200');
            break;
        case 'warning':
            notification.classList.add('bg-yellow-50', 'text-yellow-800', 'border', 'border-yellow-200');
            break;
        default:
            notification.classList.add('bg-blue-50', 'text-blue-800', 'border', 'border-blue-200');
    }
    
    notification.textContent = message;
    
    // Add to container
    container.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('opacity-0');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}