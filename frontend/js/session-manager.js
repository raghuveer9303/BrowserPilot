/**
 * BrowserPilot Session Manager
 * Handles creation and management of browser sessions
 */
class SessionManager {
    constructor() {
        this.sessions = {};
        this.currentSessionId = null;
        
        // Elements
        this.sessionForm = document.getElementById('sessionForm');
        this.sessionList = document.getElementById('sessionList');
        this.statusBadge = document.getElementById('statusBadge');
        this.currentSessionTitle = document.getElementById('currentSessionTitle');
        this.activityLog = document.getElementById('activityLog');
        this.runAgentBtn = document.getElementById('runAgentBtn');
        this.stopAgentBtn = document.getElementById('stopAgentBtn');
        this.agentInstructions = document.getElementById('agentInstructions');
        
        // Initialize event listeners
        this._initEventListeners();
        
        // Load existing sessions
        this._loadSessions();
    }
    
    /**
     * Initialize event listeners
     */
    _initEventListeners() {
        // Session form submission
        this.sessionForm.addEventListener('submit', this._handleSessionCreate.bind(this));
        
        // Agent control buttons
        this.runAgentBtn.addEventListener('click', this._handleRunAgent.bind(this));
        this.stopAgentBtn.addEventListener('click', this._handleStopAgent.bind(this));
    }
    
    /**
     * Load existing sessions from the API
     */
    async _loadSessions() {
        try {
            const response = await fetch('/api/sessions');
            if (!response.ok) throw new Error('Failed to load sessions');
            
            const sessions = await response.json();
            
            // Clear the current list
            this._clearSessionList();
            
            // Add each session to the list
            if (sessions.length > 0) {
                sessions.forEach(session => {
                    this._addSessionToList(session);
                    this.sessions[session.id] = session;
                });
            } else {
                // Show "no sessions" message
                this._showNoSessionsMessage();
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            this._logActivity('Error', `Failed to load sessions: ${error.message}`);
        }
    }
    
    /**
     * Handle session creation form submission
     */
    async _handleSessionCreate(event) {
        event.preventDefault();
        
        const sessionName = document.getElementById('sessionName').value || 'New Session';
        const browserType = document.getElementById('browserType').value;
        const createButton = document.getElementById('createSessionBtn');
        
        // Show loading state
        const originalButtonText = createButton.textContent;
        createButton.textContent = 'Creating...';
        createButton.disabled = true;
        
        try {
            // Create session via API
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: sessionName,
                    browser_type: browserType,
                    parameters: {}
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to create session');
            }
            
            const session = await response.json();
            
            // Add session to list
            this._addSessionToList(session);
            this.sessions[session.id] = session;
            
            // Connect to the new session
            this._connectToSession(session.id);
            
            // Log activity
            this._logActivity('Create', `Created new session: ${sessionName}`);
            
            // Reset form
            this.sessionForm.reset();
        } catch (error) {
            console.error('Error creating session:', error);
            this._logActivity('Error', `Failed to create session: ${error.message}`);
        } finally {
            // Reset button state
            createButton.textContent = originalButtonText;
            createButton.disabled = false;
        }
    }
    
    /**
     * Add a session to the sessions list
     */
    _addSessionToList(session) {
        // Clear "no sessions" message if present
        if (this.sessionList.querySelector('.text-center')) {
            this.sessionList.innerHTML = '';
        }
        
        // Create session card from template
        const template = document.getElementById('session-card-template').innerHTML;
        const sessionCard = document.createElement('div');
        sessionCard.id = `session-${session.id}`;
        sessionCard.classList.add('session-card-container');
        sessionCard.innerHTML = template
            .replace(/{sessionName}/g, session.name)
            .replace(/{status}/g, session.status);
        
        // Add event listeners
        sessionCard.querySelector('.connect-session-btn').addEventListener('click', () => {
            this._connectToSession(session.id);
        });
        
        sessionCard.querySelector('.delete-session-btn').addEventListener('click', () => {
            this._deleteSession(session.id);
        });
        
        // Add to list
        this.sessionList.appendChild(sessionCard);
    }
    
    /**
     * Connect to a session
     */
    async _connectToSession(sessionId) {
        if (!sessionId || !this.sessions[sessionId]) return;
        
        const session = this.sessions[sessionId];
        
        try {
            // Update UI
            this.statusBadge.textContent = session.status;
            this.currentSessionTitle.textContent = `Session: ${session.name}`;
            this.currentSessionId = sessionId;
            
            // Update status badge style
            this._updateStatusBadge(session.status);
            
            // Enable agent controls
            this.runAgentBtn.disabled = false;
            this.stopAgentBtn.disabled = false;
            
            // Log activity
            this._logActivity('Connect', `Connected to session: ${session.name}`);
            
            // Connect VNC viewer
            window.vncViewer.connect(sessionId);
            
            // Update highlighted session in list
            this._updateSessionHighlight(sessionId);
        } catch (error) {
            console.error('Error connecting to session:', error);
            this._logActivity('Error', `Failed to connect to session: ${error.message}`);
        }
    }
    
    /**
     * Delete a session
     */
    async _deleteSession(sessionId) {
        if (!confirm('Are you sure you want to delete this session?')) return;
        
        try {
            // Delete session via API
            const response = await fetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete session');
            }
            
            // Remove from sessions object
            const sessionName = this.sessions[sessionId]?.name || 'Unknown';
            delete this.sessions[sessionId];
            
            // Remove from UI
            const sessionElement = document.getElementById(`session-${sessionId}`);
            if (sessionElement) {
                sessionElement.remove();
            }
            
            // If this was the current session, disconnect
            if (this.currentSessionId === sessionId) {
                this._disconnectCurrentSession();
            }
            
            // Log activity
            this._logActivity('Delete', `Deleted session: ${sessionName}`);
            
            // Check if we need to show "no sessions" message
            if (Object.keys(this.sessions).length === 0) {
                this._showNoSessionsMessage();
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            this._logActivity('Error', `Failed to delete session: ${error.message}`);
        }
    }
    
    /**
     * Disconnect from the current session
     */
    _disconnectCurrentSession() {
        // Reset UI
        this.statusBadge.textContent = 'No active session';
        this.statusBadge.className = 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800';
        this.currentSessionTitle.textContent = 'Browser View';
        this.currentSessionId = null;
        
        // Disable agent controls
        this.runAgentBtn.disabled = true;
        this.stopAgentBtn.disabled = true;
        
        // Disconnect VNC viewer
        window.vncViewer.disconnect();
        
        // Remove session highlight
        this._updateSessionHighlight(null);
    }
    
    /**
     * Run agent on current session
     */
    async _handleRunAgent() {
        if (!this.currentSessionId) return;
        
        const instructions = this.agentInstructions.value.trim();
        if (!instructions) {
            alert('Please enter instructions for the agent.');
            return;
        }
        
        try {
            // Create a task via API
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    instructions: instructions,
                    session_id: this.currentSessionId,
                    model: 'default',
                    max_steps: 10
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to run agent');
            }
            
            const task = await response.json();
            
            // Disable run button, enable stop button
            this.runAgentBtn.disabled = true;
            this.stopAgentBtn.disabled = false;
            
            // Log activity
            this._logActivity('Agent', `Started agent with task ID: ${task.id}`);
            
            // Connect to task WebSocket for updates
            this._connectToTaskWebSocket(task.id);
        } catch (error) {
            console.error('Error running agent:', error);
            this._logActivity('Error', `Failed to run agent: ${error.message}`);
        }
    }
    
    /**
     * Stop agent on current session
     */
    async _handleStopAgent() {
        if (!this.currentSessionId) return;
        
        try {
            // Assuming the task ID is stored somewhere, we'd cancel it
            // For now, just log it
            this._logActivity('Agent', 'Stopped agent');
            
            // Enable run button
            this.runAgentBtn.disabled = false;
            this.stopAgentBtn.disabled = true;
        } catch (error) {
            console.error('Error stopping agent:', error);
            this._logActivity('Error', `Failed to stop agent: ${error.message}`);
        }
    }
    
    /**
     * Connect to task WebSocket for real-time updates
     */
    _connectToTaskWebSocket(taskId) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/tasks/${taskId}`;
        
        const socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            this._logActivity('WebSocket', `Connected to task ${taskId}`);
        };
        
        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                if (message.type === 'step') {
                    // Handle step update
                    this._logActivity('Step', message.data.description || 'Agent performed an action');
                } else if (message.type === 'status' && message.data) {
                    // Handle status update
                    this._logActivity('Status', `Task status: ${message.data.status}`);
                    
                    // If task completed or failed, re-enable buttons
                    if (['completed', 'error', 'cancelled'].includes(message.data.status)) {
                        this.runAgentBtn.disabled = false;
                        this.stopAgentBtn.disabled = true;
                    }
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        socket.onclose = () => {
            this._logActivity('WebSocket', `Disconnected from task ${taskId}`);
            
            // Re-enable buttons
            this.runAgentBtn.disabled = false;
            this.stopAgentBtn.disabled = true;
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this._logActivity('Error', 'WebSocket connection error');
            
            // Re-enable buttons
            this.runAgentBtn.disabled = false;
            this.stopAgentBtn.disabled = true;
        };
    }
    
    /**
     * Log an activity in the activity log
     */
    _logActivity(action, message) {
        // Create log item from template
        const template = document.getElementById('log-item-template').innerHTML;
        const time = new Date().toLocaleTimeString();
        
        const logItem = document.createElement('div');
        logItem.innerHTML = template
            .replace('{action}', action)
            .replace('{time}', time)
            .replace('{message}', message);
        
        // Clear "no activity" message if present
        if (this.activityLog.querySelector('.text-center')) {
            this.activityLog.innerHTML = '';
        }
        
        // Add to log
        this.activityLog.appendChild(logItem.firstElementChild);
        
        // Scroll to bottom
        this.activityLog.scrollTop = this.activityLog.scrollHeight;
    }
    
    /**
     * Update the status badge appearance based on status
     */
    _updateStatusBadge(status) {
        this.statusBadge.textContent = status;
        this.statusBadge.className = 'px-2 py-1 text-xs font-medium rounded-full';
        
        switch (status) {
            case 'running':
                this.statusBadge.classList.add('bg-green-100', 'text-green-800');
                break;
            case 'initializing':
                this.statusBadge.classList.add('bg-blue-100', 'text-blue-800');
                break;
            case 'error':
                this.statusBadge.classList.add('bg-red-100', 'text-red-800');
                break;
            default:
                this.statusBadge.classList.add('bg-gray-100', 'text-gray-800');
        }
    }
    
    /**
     * Update highlighted session in the session list
     */
    _updateSessionHighlight(sessionId) {
        // Remove highlight from all sessions
        document.querySelectorAll('.session-card-container').forEach(el => {
            el.classList.remove('ring-2', 'ring-indigo-500');
        });
        
        // Add highlight to selected session
        if (sessionId) {
            const sessionElement = document.getElementById(`session-${sessionId}`);
            if (sessionElement) {
                sessionElement.classList.add('ring-2', 'ring-indigo-500');
            }
        }
    }
    
    /**
     * Clear the session list
     */
    _clearSessionList() {
        this.sessionList.innerHTML = '';
    }
    
    /**
     * Show "no sessions" message
     */
    _showNoSessionsMessage() {
        this.sessionList.innerHTML = '<div class="text-sm text-gray-500 text-center py-4">No active sessions</div>';
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.sessionManager = new SessionManager();
});