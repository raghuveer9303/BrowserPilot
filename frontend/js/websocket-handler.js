/**
 * WebSocket handler for BrowserPilot
 * Manages WebSocket connections to the server
 */
class WebSocketHandler {
    constructor(taskId, onMessageCallback, onStatusChangeCallback) {
        this.taskId = taskId;
        this.onMessageCallback = onMessageCallback;
        this.onStatusChangeCallback = onStatusChangeCallback;
        this.connection = null;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 2000; // Start with 2s delay
        this.status = 'disconnected';
    }

    connect() {
        if (this.connection) {
            this.close();
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Fix: Change from '/ws/tasks/' to '/api/tasks/ws/'
        const wsUrl = `${protocol}//${window.location.host}/api/tasks/ws/${this.taskId}`;
        
        this.connection = new WebSocket(wsUrl);
        this._setStatus('connecting');
        
        this.connection.onopen = () => {
            console.log(`WebSocket connected to task ${this.taskId}`);
            this._setStatus('connected');
            this.retryCount = 0;
            this.retryDelay = 2000;
        };
        
        this.connection.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (this.onMessageCallback) {
                    this.onMessageCallback(message);
                }
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };
        
        this.connection.onclose = (event) => {
            if (this.status !== 'closed') {
                console.log(`WebSocket disconnected from task ${this.taskId}`);
                this._setStatus('disconnected');
                
                if (this.retryCount < this.maxRetries) {
                    this.retryCount++;
                    setTimeout(() => this.connect(), this.retryDelay);
                    this.retryDelay = Math.min(this.retryDelay * 1.5, 30000);
                }
            }
        };
        
        this.connection.onerror = (error) => {
            console.error(`WebSocket error for task ${this.taskId}:`, error);
            this._setStatus('error');
        };
    }
    
    close() {
        if (this.connection) {
            this._setStatus('closed');
            this.connection.close();
            this.connection = null;
        }
    }
    
    send(message) {
        if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            if (typeof message === 'object') {
                this.connection.send(JSON.stringify(message));
            } else {
                this.connection.send(message);
            }
            return true;
        }
        return false;
    }
    
    _setStatus(status) {
        if (status !== this.status) {
            this.status = status;
            
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback(status);
            }
        }
    }
    
    isConnected() {
        return this.connection && this.connection.readyState === WebSocket.OPEN;
    }
}

// Export as a global if not using modules
if (typeof window !== 'undefined') {
    window.WebSocketHandler = WebSocketHandler;
}