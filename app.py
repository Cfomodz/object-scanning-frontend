from flask import Flask, request, jsonify, render_template
from flask_socketio import SocketIO, emit
from capture_object import CaptureConfig, capture_objects
import threading
import logging

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, 
    static_url_path='', 
    static_folder='static',
    template_folder='templates')
    
socketio = SocketIO(app, cors_allowed_origins="*")

# Initial screen state
current_state = {
    "object_id": 0,
    "image_number": 0,
    "status": "ready"
}

capture_thread = None

def start_capture_process():
    """Run the capture process in a separate thread"""
    logger.debug("Starting capture process...")
    config = CaptureConfig(
        socket_url='http://localhost:5000',
        clear_output_dir=True,
        camera_index=0  # Try 0 first, then 1 if it doesn't work
    )
    try:
        logger.debug("Initializing capture with config...")
        capture_objects(config)
    except Exception as e:
        logger.error(f"Error in capture process: {e}", exc_info=True)

@socketio.on('connect')
def handle_connect():
    """
    Start the capture process if it's not running and
    send the current state to the newly connected client.
    """
    global capture_thread
    
    # Emit debug message to client
    socketio.emit('debug_message', {
        'message': 'Initializing capture system...',
        'type': 'info'
    })
    
    # Start capture process if it's not already running
    if capture_thread is None or not capture_thread.is_alive():
        socketio.emit('debug_message', {
            'message': 'Starting capture thread...',
            'type': 'info'
        })
        capture_thread = threading.Thread(target=start_capture_process)
        capture_thread.daemon = True
        capture_thread.start()
    else:
        socketio.emit('debug_message', {
            'message': 'Capture thread already running',
            'type': 'info'
        })
    
    emit('update_state', current_state)

@socketio.on('disconnect')
def handle_disconnect():
    logger.debug("Client disconnected")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/state', methods=['POST'])
def set_state():
    """
    Set the screen state and notify all WebSocket clients.
    """
    global current_state
    data = request.json
    
    # Validate incoming state
    valid_keys = {"object_id", "image_number", "status"}
    if not all(key in valid_keys for key in data.keys()):
        return jsonify({"success": False, "error": "Invalid state keys"}), 400
        
    if "status" in data and data["status"] not in ["ready", "capturing", "processing", "error"]:
        return jsonify({"success": False, "error": "Invalid status"}), 400
    
    # Update only provided fields
    current_state.update(data)
    
    # Notify all connected clients
    socketio.emit('update_state', current_state)
    return jsonify({"success": True, "state": current_state})

@socketio.on('resume_capture')
def handle_resume():
    """Handle resume capture request from client"""
    global current_state
    if current_state['status'] == 'waiting':
        current_state['status'] = 'ready'
        socketio.emit('update_state', current_state)

if __name__ == '__main__':
    logger.info("Starting Flask application...")
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
