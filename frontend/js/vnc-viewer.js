/**
 * BrowserPilot VNC Viewer
 * Handles noVNC connection and display
 */
class VncViewer {
    constructor() {
        // Elements
        this.vncFrame = document.getElementById('vncViewer');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.browserContainer = document.getElementById('browserContainer');
        
        // State
        this.connected = false;
        this.currentSessionId = null;
        
        // Initialize
        this._init();
    }
    
    /**
     * Initialize the VNC viewer
     */
    _init() {
        // Set up event listeners
        this.fullscreenBtn.addEventListener('click', this._toggleFullscreen.bind(this));
        
        // Handle iframe load events
        this.vncFrame.addEventListener('load', () => {
            if (this.connected) {
                setTimeout(() => {
                    this._hideLoading();
                }, 1000);
            }
        });
    }
    
    /**
     * Connect to a VNC session
     */
    async connect(sessionId) {
        if (!sessionId) return;
        
        this.currentSessionId = sessionId;
        this._showLoading('Connecting to browser...');
        
        try {
            // Get VNC connection info
            const response = await fetch('/api/vnc_info');
            if (!response.ok) {
                throw new Error('Failed to get VNC info');
            }
            
            const data = await response.json();
            const password = encodeURIComponent(data.password || 'browserpilot');
            const port = data.port || 6080;
            
            // Construct noVNC URL
            const vncUrl = `/static/novnc/vnc.html?host=${window.location.hostname}&port=${port}&path=websockify&autoconnect=true&resize=scale&password=${password}&show_dot=true`;
            
            // Load VNC frame
            this.vncFrame.src = vncUrl;
            this.connected = true;
            
            // Log the connection
            console.log(`Connected to VNC session: ${sessionId}`);
        } catch (error) {
            console.error('VNC connection error:', error);
            this._showError(`Failed to connect: ${error.message}`);
        }
    }
    
    /**
     * Disconnect from the current VNC session
     */
    disconnect() {
        if (!this.connected) return;
        
        // Reset iframe
        this.vncFrame.src = 'about:blank';
        this.connected = false;
        this.currentSessionId = null;
        
        // Show disconnected state
        this._showLoading('No active session');
        
        console.log('Disconnected from VNC session');
    }
    
    /**
     * Toggle fullscreen mode
     */
    _toggleFullscreen() {
        if (!document.fullscreenElement) {
            if (this.browserContainer.requestFullscreen) {
                this.browserContainer.requestFullscreen();
            } else if (this.browserContainer.webkitRequestFullscreen) {
                this.browserContainer.webkitRequestFullscreen();
            } else if (this.browserContainer.msRequestFullscreen) {
                this.browserContainer.msRequestFullscreen();
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
     * Show loading overlay with message
     */
    _showLoading(message) {
        this.loadingText.textContent = message || 'Loading...';
        this.loadingOverlay.style.display = 'flex';
    }
    
    /**
     * Hide loading overlay
     */
    _hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }
    
    /**
     * Show an error message
     */
    _showError(message) {
        this.loadingText.innerHTML = `<span class="text-red-600">${message}</span>`;
        this.loadingOverlay.style.display = 'flex';
    }
    
    /**
     * Get the current connection status
     */
    isConnected() {
        return this.connected;
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.vncViewer = new VncViewer();
});