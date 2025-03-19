// Complete the browser-view.js script with handlers for the missing functions

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

async function handlePause() {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (!sessionId) return;
    
    const pauseBtn = document.getElementById('pauseBtn');
    const isPaused = pauseBtn.textContent.includes('Resume');
    const action = isPaused ? 'resume' : 'pause';
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}/${action}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`Failed to ${action} session`);
        }
        
        pauseBtn.textContent = isPaused ? 'Pause Task' : 'Resume Task';
    } catch (error) {
        console.error(`Error ${action}ing session:`, error);
        alert(`Failed to ${action} session: ${error.message}`);
    }
}

async function handleStop() {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (!sessionId) return;
    
    if (!confirm('Are you sure you want to stop this task? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}/stop`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to stop session');
        }
        
        document.getElementById('statusBadge').textContent = 'stopped';
        document.getElementById('statusBadge').className = 'px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800';
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('stopBtn').disabled = true;
    } catch (error) {
        console.error('Error stopping session:', error);
        alert(`Failed to stop session: ${error.message}`);
    }
}