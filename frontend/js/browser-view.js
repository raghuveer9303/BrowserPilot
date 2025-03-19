/**
 * Browser View JavaScript
 * Handles browser view display and interaction
 */

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const browserFrame = document.getElementById('browserFrame');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const taskTitle = document.getElementById('taskTitle');
    const statusBadge = document.getElementById('statusBadge');
    const currentAction = document.getElementById('currentAction');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const backBtn = document.getElementById('backBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    // Get task ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('taskId');
    let websocketHandler = null;
    
    // Disable controls initially
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    
    // Check if task ID is provided
    if (!taskId) {
        loadingText.textContent = 'No task ID provided';
        return;
    }
    
    // Update task title
    taskTitle.textContent = `Task: ${taskId.substring(0, 8)}...`;
    
    // Initialize WebSocket connection
    initWebSocket();
    
    // Set up VNC connection
    initVncConnection();
    
    // Button event listeners
    pauseBtn.addEventListener('click', handlePause);
    stopBtn.addEventListener('click', handleStop);
    backBtn.addEventListener('click', () => window.location.href = '/');
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Functions
    function initWebSocket() {
        websocketHandler = new WebSocketHandler(
            taskId,
            handleWebSocketMessage,
            handleStatusChange
        );
        websocketHandler.connect();
    }
    
    async function initVncConnection() {
        try {
            loadingText.textContent = 'Connecting to browser...';
            
            const response = await fetch('/api/vnc_info');
            if (!response.ok) {
                throw new Error('Failed to get VNC info');
            }
            
            const data = await response.json();
            const vncUrl = `/static/novnc/vnc.html?path=websockify&autoconnect=true&resize=scale&password=${encodeURIComponent(data.password)}`;
            
            browserFrame.src = vncUrl;
            browserFrame.onload = () => {
                // Hide loading overlay with delay for better UX
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 1000);
            };
        } catch (error) {
            console.error('VNC connection error:', error);
            loadingText.textContent = 'Failed to connect to browser. Please try refreshing.';
        }
    }
    
    function handleWebSocketMessage(message) {
        console.log('Received message:', message);
        
        if (message.type === 'step') {
            updateCurrentAction(message.data);
        } else if (message.type === 'status') {
            updateStatus(message.data.status);
        } else if (message.type === 'error') {
            showError(message.data.message || 'An unknown error occurred');
        }
    }
    
    function handleStatusChange(status) {
        console.log('WebSocket status changed:', status);
        
        if (status === 'error' || status === 'disconnected') {
            showError('Connection to server lost. Attempting to reconnect...');
        } else if (status === 'connected') {
            loadingText.textContent = 'Connected to task. Loading browser...';
        }
    }
    
    function updateCurrentAction(stepData) {
        if (!stepData) return;
        
        const stepTime = new Date().toLocaleTimeString();
        const actionHtml = `
            <div class="bg-gray-50 rounded-lg border border-gray-200 p-4 animate-fade-in">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-medium">${stepData.action || 'Action'}</h3>
                    <span class="text-xs text-gray-500">${stepTime}</span>
                </div>
                <p class="text-sm text-gray-700 mb-2">${stepData.description || 'No description provided'}</p>
                ${stepData.screenshot ? `<img src="data:image/png;base64,${stepData.screenshot}" class="screenshot-preview" alt="Screenshot">` : ''}
            </div>
        `;
        
        currentAction.innerHTML = actionHtml;
    }
    
    function updateStatus(status) {
        // Update status badge
        statusBadge.textContent = status;
        statusBadge.className = 'px-2 py-1 text-xs font-medium rounded-full';
        
        // Set appropriate status colors
        switch (status) {
            case 'running':
                statusBadge.classList.add('bg-blue-100', 'text-blue-800');
                pauseBtn.disabled = false;
                stopBtn.disabled = false;
                break;
            case 'paused':
                statusBadge.classList.add('bg-yellow-100', 'text-yellow-800');
                pauseBtn.textContent = 'Resume Task';
                pauseBtn.disabled = false;
                stopBtn.disabled = false;
                break;
            case 'completed':
                statusBadge.classList.add('bg-green-100', 'text-green-800');
                pauseBtn.disabled = true;
                stopBtn.disabled = true;
                break;
            case 'error':
                statusBadge.classList.add('bg-red-100', 'text-red-800');
                pauseBtn.disabled = true;
                stopBtn.disabled = true;
                break;
            case 'cancelled':
                statusBadge.classList.add('bg-gray-100', 'text-gray-800');
                pauseBtn.disabled = true;
                stopBtn.disabled = true;
                break;
            default:
                statusBadge.classList.add('bg-gray-100', 'text-gray-800');
        }
    }
    
    function showError(message) {
        currentAction.innerHTML = `
            <div class="bg-red-50 rounded-lg border border-red-200 p-4">
                <h3 class="font-medium text-red-800 mb-1">Error</h3>
                <p class="text-sm text-red-700">${message}</p>
            </div>
        `;
    }
    
    async function handlePause() {
        if (!taskId) return;
        
        const isPaused = pauseBtn.textContent.includes('Resume');
        const action = isPaused ? 'resume' : 'pause';
        
        try {
            const response = await fetch(`/api/tasks/${taskId}/${action}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to ${action} task`);
            }
            
            // Update button text (will be properly updated when status event comes in)
            pauseBtn.textContent = isPaused ? 'Pause Task' : 'Resume Task';
        } catch (error) {
            console.error(`Error ${action}ing task:`, error);
            showError(`Failed to ${action} task: ${error.message}`);
        }
    }
    
    async function handleStop() {
        if (!taskId) return;
        
        if (!confirm('Are you sure you want to stop this task? This action cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to stop task');
            }
            
            updateStatus('cancelled');
        } catch (error) {
            console.error('Error stopping task:', error);
            showError(`Failed to stop task: ${error.message}`);
        }
    }
    
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
});