import socketio
import os
import shutil
import cv2
import time
import requests
import winsound
from requests_toolbelt.multipart.encoder import MultipartEncoder
from pynput import keyboard
import base64
import numpy as np
import threading
import logging

# Set up logging
logger = logging.getLogger(__name__)

class CaptureSocketClient:
    def __init__(self, url='http://localhost:5000'):
        logger.debug(f"Initializing CaptureSocketClient with URL: {url}")
        self.sio = socketio.Client()
        self.url = url
        self.current_object = 0
        self.resume_event = threading.Event()
        
        @self.sio.on('connect')
        def on_connect():
            logger.debug('Socket.IO Connected to server')
            
        @self.sio.on('disconnect')
        def on_disconnect():
            logger.debug('Socket.IO Disconnected from server')
            
        @self.sio.on('update_state')
        def on_state_update(data):
            logger.debug(f"State updated: {data}")
            if data['status'] == 'ready':
                self.resume_event.set()

    def connect(self):
        try:
            self.sio.connect(self.url)
            return True
        except Exception as e:
            print(f"Failed to connect: {e}")
            return False
            
    def set_state(self, object_id, image_number, status="ready"):
        try:
            state = {
                "object_id": object_id,
                "image_number": image_number,
                "status": status
            }
            self.sio.emit('set_state', state)
            return True
        except Exception as e:
            print(f"Failed to set state: {e}")
            return False
            
    def disconnect(self):
        try:
            self.sio.disconnect()
        except:
            pass

    def send_live_frame(self, frame):
        try:
            frame_data = frame_to_base64(frame)
            logger.debug("Sending live frame")
            self.sio.emit('live_frame', frame_data)
        except Exception as e:
            logger.error(f"Failed to send live frame: {e}")
        
    def send_capture_frame(self, frame):
        try:
            frame_data = frame_to_base64(frame)
            logger.debug("Sending capture frame")
            self.sio.emit('capture_frame', frame_data)
        except Exception as e:
            logger.error(f"Failed to send capture frame: {e}")
            

    def wait_for_resume(self):
        """Wait for resume signal from web interface"""
        self.resume_event.wait()
        self.resume_event.clear()

class CaptureConfig:
    def __init__(self, 
                camera_index=1,          # 0 for laptop webcam, 1 for USB webcam, etc.
                movement_threshold=1000, # pixels
                timeout=10,              # seconds
                check_interval=0.5,      # seconds
                images_dir="./images/",  # output directory
                images_per_object=2,     # number of sides to capture for each object
                hand_move_delay=1.5,     # seconds
                similarity_threshold=0.65, # 0 to 1 where 1 is identical (1 - % of pixels to determine things have changed(35% by default))
                clear_output_dir=False,   # clear output directory before starting, if False, it will need to exist
                socket_url='http://localhost:5000'):
        self.movement_threshold = movement_threshold
        self.timeout = timeout
        self.check_interval = check_interval
        self.images_dir = images_dir
        self.images_per_object = images_per_object
        self.camera_index = camera_index
        self.hand_move_delay = hand_move_delay
        self.similarity_threshold = similarity_threshold
        self.clear_output_dir = clear_output_dir
        self.socket_url = socket_url
        self.socket_client = None

def detect_movement(frame1, frame2, threshold):
    diff = cv2.absdiff(frame1, frame2)
    gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 20, 255, cv2.THRESH_BINARY)
    dilated = cv2.dilate(thresh, None, iterations=3)
    contours, _ = cv2.findContours(dilated, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    for contour in contours:
        if cv2.contourArea(contour) > threshold:
            return True
    return False

def is_frame_different(frame1, frame2, threshold=0.65):
    similarity = cv2.matchTemplate(frame1, frame2, cv2.TM_CCOEFF_NORMED)[0][0]
    print(f"Similarity: {similarity}")
    return similarity < threshold

def clear_output_directory(directory):
    if os.path.exists(directory):
        shutil.rmtree(directory)
    os.makedirs(directory)
    print(f"Cleared and recreated {directory}")

def wait_for_next_side(cap, previous_frame, config):
    start_time = time.time()
    last_frame = previous_frame.copy()
    warning_shown = False

    while time.time() - start_time < config.timeout:
        time.sleep(config.check_interval)
        ret, current_frame = cap.read()
        if not ret:
            logger.error("Failed to grab frame while waiting for next side")
            return None

        # Instead of displaying with plt, send the frame to web interface
        if not warning_shown and (time.time() - start_time) > config.timeout/2:
            # Send the current frame to web interface
            config.socket_client.send_live_frame(current_frame)
            warning_shown = True

        if not detect_movement(last_frame, current_frame, config.movement_threshold) and \
        is_frame_different(previous_frame, current_frame, config.similarity_threshold):
            return current_frame

        last_frame = current_frame.copy()

    logger.debug("Timeout waiting for next side")
    return None

def frame_to_base64(frame):
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')

def capture_objects(config=None):
    if config is None:
        config = CaptureConfig()
    
    # Initialize socket connection
    config.socket_client = CaptureSocketClient(config.socket_url)
    if not config.socket_client.connect():
        print("Warning: Failed to connect to WebSocket server")
    
    current_object = 0
    
    try:
        if config.clear_output_dir:
            clear_output_directory(config.images_dir)
        
        cap = cv2.VideoCapture(config.camera_index)
        last_capture_time = time.time()
        
        # Replace individual frame variables with a list
        current_frames = []
        previous_frames = []
        waiting_for_next = False

        # Update keyboard listener
        def on_press(key):
            nonlocal current_frames, previous_frames, waiting_for_next, last_capture_time
            try:
                if key.char.lower() == 'x':
                    if waiting_for_next:
                        print("Retaking current image...")
                        current_frames.pop()  # Remove last captured image
                        waiting_for_next = True
                        last_capture_time = time.time()
                    elif previous_frames:
                        print("Retaking previous object...")
                        current_frames = []
                        previous_frames = []
                        waiting_for_next = False
                        last_capture_time = time.time()
            except AttributeError:
                pass

        listener = keyboard.Listener(on_press=on_press)
        listener.start()

        ret, previous_frame = cap.read()
        if not ret:
            print("Failed to grab initial frame")
            return

        while True:
            ret, frame = cap.read()
            if not ret:
                print("Failed to grab frame")
                break

            # Send live frame for preview
            config.socket_client.send_live_frame(frame)

            current_time = time.time()
            if current_time - last_capture_time > config.timeout:
                config.socket_client.set_state(current_object, 0, "waiting")
                print("Waiting for resume signal from web interface...")
                config.socket_client.wait_for_resume()
                last_capture_time = current_time
                previous_frame = frame.copy()
                continue

            if detect_movement(previous_frame, frame, config.movement_threshold):
                # Wait for hand to move away
                time.sleep(config.hand_move_delay)
                
                # Capture image and send it
                ret, frame = cap.read()
                if ret:
                    config.socket_client.send_capture_frame(frame)
                    current_side = len(current_frames) + 1
                    print(f"Side {current_side} captured")
                    winsound.PlaySound("ba_dum_notification.wav", winsound.SND_FILENAME)
                
                # Save previous object images if we have a complete set
                if len(previous_frames) == config.images_per_object:
                    for i, prev_frame in enumerate(previous_frames):
                        image_path = f"{config.images_dir}object_side{i+1}_{int(time.time())}.jpg"
                        cv2.imwrite(image_path, prev_frame)
                    print("Previous object images saved")
                    previous_frames = []

                current_frames.append(frame.copy())
                current_side = len(current_frames)
                print(f"Side {current_side} captured")
                winsound.PlaySound("ba_dum_notification.wav", winsound.SND_FILENAME)
                
                if current_side < config.images_per_object:
                    waiting_for_next = True
                    # Wait for next side
                    time.sleep(1)
                    next_frame = wait_for_next_side(cap, frame, config)
                    if next_frame is None:
                        print(f"Failed to capture side {current_side + 1}. Please try again.")
                        current_frames.pop()  # Remove the last captured frame
                        waiting_for_next = False
                else:
                    # We've captured all sides
                    previous_frames = current_frames.copy()
                    current_frames = []
                    waiting_for_next = False
                    print("All sides captured")
                    winsound.PlaySound("ba_dum_notification.wav", winsound.SND_FILENAME)

                last_capture_time = current_time

            previous_frame = frame.copy()
            time.sleep(0.2)
            
    finally:
        if config.socket_client:
            config.socket_client.disconnect()
        listener.stop()
        cap.release()

def emit_debug(message, type='info'):
    try:
        socketio.emit('debug_message', {
            'message': message,
            'type': type
        })
    except Exception as e:
        print(f"Failed to emit debug message: {e}")
