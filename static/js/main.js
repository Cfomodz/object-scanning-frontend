const socket = io();
const body = document.body;
const objectId = document.getElementById('object-id');
const imageNumber = document.getElementById('image-number');
const statusElement = document.getElementById('status');
const lastCapture = document.getElementById('last-capture');
const liveView = document.getElementById('live-view');
const resumeBtn = document.getElementById('resume-capture');
const autoDownload = document.getElementById('auto-download');
const debugLog = document.getElementById('debug-log');
const clearDebugBtn = document.getElementById('clear-debug');

let lastImageData = null;

// Debug console functions
function addDebugMessage(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const msgElement = document.createElement('div');
    msgElement.className = `debug-message ${type}`;
    msgElement.textContent = `[${timestamp}] ${message}`;
    debugLog.appendChild(msgElement);
    debugLog.scrollTop = debugLog.scrollHeight;
}

clearDebugBtn.addEventListener('click', () => {
    debugLog.innerHTML = '';
});

// Socket event handlers
socket.on('connect', () => {
    addDebugMessage('Connected to server');
});

socket.on('update_state', (data) => {
    addDebugMessage(`State update: Object ${data.object_id}, Image ${data.image_number}, Status: ${data.status}`);
    
    objectId.textContent = `Object #${data.object_id}`;
    imageNumber.textContent = `Image ${data.image_number}`;
    statusElement.textContent = data.status;
    body.className = data.status;
    
    resumeBtn.style.display = data.status === 'waiting' ? 'inline-block' : 'none';
});

socket.on('live_frame', (frameData) => {
    if (frameData) {
        liveView.src = `data:image/jpeg;base64,${frameData}`;
    }
});

socket.on('capture_frame', (frameData) => {
    if (frameData) {
        lastCapture.src = `data:image/jpeg;base64,${frameData}`;
        lastImageData = frameData;
        
        // Auto download if enabled
        if (autoDownload.checked) {
            downloadImage(frameData);
        }
        addDebugMessage('Image captured and saved');
    }
});

// Handle server-side debug messages
socket.on('debug_message', (data) => {
    addDebugMessage(data.message, data.type || 'info');
});

socket.on('error', (error) => {
    addDebugMessage(error, 'error');
});

socket.on('disconnect', () => {
    addDebugMessage('Disconnected from server', 'error');
    statusElement.textContent = 'DISCONNECTED';
    body.className = 'error';
});

// Helper functions
function downloadImage(imageData) {
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${imageData}`;
    link.download = `capture_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event listeners
resumeBtn.addEventListener('click', () => {
    socket.emit('resume_capture');
    addDebugMessage('Resume capture requested');
});

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && statusElement.textContent === 'waiting') {
        socket.emit('resume_capture');
        addDebugMessage('Resume capture requested (Enter key)');
    }
});

// Save auto-download preference
autoDownload.checked = localStorage.getItem('autoDownload') === 'true';
autoDownload.addEventListener('change', () => {
    localStorage.setItem('autoDownload', autoDownload.checked);
    addDebugMessage(`Auto download ${autoDownload.checked ? 'enabled' : 'disabled'}`);
});

// Initial debug message
addDebugMessage('Application started');