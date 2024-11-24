// main.js

// Define Module with onRuntimeInitialized before OpenCV.js is loaded
var Module = {
    onRuntimeInitialized: function() {
        // OpenCV.js is ready
        addDebugMessage('OpenCV.js is ready');
        startWebcam();
    }
};

const liveView = document.getElementById('live-view');
const lastCapturedView = document.getElementById('last-captured-view');
const statusElement = document.getElementById('status');
const debugLog = document.getElementById('debug-log');
const startCaptureBtn = document.getElementById('start-capture');
const clearDebugBtn = document.getElementById('clear-debug');

let capturing = true;
let motionDetected = false;
let motionTimeout = null;
let detectingMotion = false; // To prevent multiple concurrent detectMotion calls

function addDebugMessage(message) {
    const timestamp = new Date().toLocaleTimeString();
    const msgElement = document.createElement('div');
    msgElement.textContent = `[${timestamp}] ${message}`;
    
    // Prepend the new message to the top of the debug log
    debugLog.insertBefore(msgElement, debugLog.firstChild);
}

function startWebcam(deviceId) {
    const constraints = {
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            deviceId: deviceId ? { exact: deviceId } : undefined
        }
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            liveView.srcObject = stream;
            liveView.onloadedmetadata = () => {
                liveView.play();
                addDebugMessage('Webcam started');
                if (capturing) {
                    addDebugMessage('Starting motion detection');
                    detectMotion();
                }
            };
        })
        .catch(err => {
            addDebugMessage(`Error accessing webcam: ${err}`);
        });
}

function detectMotion() {
    if (!capturing || detectingMotion) {
        return;
    }
    detectingMotion = true;

    const width = 320; // Lower resolution for motion detection
    const height = 240;

    const canvasFrame = document.createElement('canvas');
    canvasFrame.width = width;
    canvasFrame.height = height;
    const context = canvasFrame.getContext('2d');

    let frame = new cv.Mat(height, width, cv.CV_8UC4);
    let gray = new cv.Mat();
    let prevGray = new cv.Mat();
    let diff = new cv.Mat();
    let thresh = new cv.Mat();

    const fps = 10;
    const delay = 1000 / fps;

    function processFrame() {
        if (!capturing) {
            detectingMotion = false;
            frame.delete();
            gray.delete();
            prevGray.delete();
            diff.delete();
            thresh.delete();
            return;
        }

        let begin = Date.now();

        // Draw the video frame onto the canvas
        context.drawImage(liveView, 0, 0, width, height);

        // Get the image data from the canvas
        let imageData = context.getImageData(0, 0, width, height);

        // Convert the canvas data to cv.Mat
        frame.data.set(imageData.data);

        // Convert to grayscale
        cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

        if (!prevGray.empty()) {
            cv.absdiff(gray, prevGray, diff);
            cv.threshold(diff, thresh, 25, 255, cv.THRESH_BINARY);

            let nonZero = cv.countNonZero(thresh);
            addDebugMessage(`Motion pixels: ${nonZero}`);

            if (nonZero > 17562) { // Adjust threshold as needed
                if (!motionDetected) {
                    motionDetected = true;
                    statusElement.textContent = 'Motion Detected';
                    liveView.style.borderColor = 'yellow';
                    addDebugMessage(`Motion detected (pixels changed: ${nonZero})`);
                }
                // Clear any existing motion timeout
                clearTimeout(motionTimeout);
            } else {
                if (motionDetected) {
                    // Motion has just stopped
                    motionDetected = false;
                    addDebugMessage('No motion detected, preparing to take picture');
                    // Start the timer to take a picture after 1.35 seconds of no motion
                    motionTimeout = setTimeout(() => {
                        takePicture();
                        statusElement.textContent = 'Ready for Next Item';
                        liveView.style.borderColor = 'green';
                        addDebugMessage('Picture taken, ready for next item');
                    }, 1350); // Wait 1.35 seconds to ensure no motion
                }
            }
        }

        // Update prevGray for the next frame
        gray.copyTo(prevGray);

        let duration = Date.now() - begin;
        setTimeout(processFrame, Math.max(0, delay - duration));
    }

    processFrame();
}

function takePicture() {
    addDebugMessage('takePicture called');

    const canvas = document.createElement('canvas');
    canvas.width = liveView.videoWidth;
    canvas.height = liveView.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(liveView, 0, 0, canvas.width, canvas.height);

    // Display the captured image
    lastCapturedView.src = canvas.toDataURL('image/png');

    // Download the image
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `captured-image-${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addDebugMessage('Picture taken');
}

startCaptureBtn.addEventListener('click', () => {
    capturing = !capturing;
    startCaptureBtn.textContent = capturing ? 'Stop Capture' : 'Start Capture';
    addDebugMessage(capturing ? 'Capture started' : 'Capture stopped');
    if (capturing) {
        detectMotion();
    } else {
        motionDetected = false;
        statusElement.textContent = 'Capture Stopped';
        liveView.style.borderColor = 'red';
        clearTimeout(motionTimeout);
    }
});

clearDebugBtn.addEventListener('click', () => {
    debugLog.innerHTML = '';
});
