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
const rotateBtn = document.getElementById('rotate-btn');

let capturing = true;
let motionDetected = false;
let motionTimeout = null;
let detectingMotion = false; // To prevent multiple concurrent detectMotion calls
let rotationAngle = 0; // Rotation angle in degrees
let videoTrack;

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
            width: { max: 1920 },
            height: { max: 1080 },
            deviceId: deviceId ? { exact: deviceId } : undefined
        }
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            liveView.srcObject = stream;
            videoTrack = stream.getVideoTracks()[0]; // Store the video track
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

        // Clear the canvas
        context.clearRect(0, 0, width, height);

        // Save the context state
        context.save();

        // Translate to the center of the canvas
        context.translate(width / 2, height / 2);

        // Rotate the canvas
        context.rotate((rotationAngle * Math.PI) / 180);

        // Draw the video frame with rotation
        context.drawImage(
            liveView,
            -width / 2,
            -height / 2,
            width,
            height
        );

        // Restore the context state
        context.restore();

        // Get the image data from the canvas after rotation
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

    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Save the context state
    context.save();

    // Translate to the center of the canvas
    context.translate(canvas.width / 2, canvas.height / 2);

    // Rotate the canvas
    context.rotate((rotationAngle * Math.PI) / 180);

    // Draw the video frame with rotation
    context.drawImage(
        liveView,
        -canvas.width / 2,
        -canvas.height / 2,
        canvas.width,
        canvas.height
    );

    // Restore the context state
    context.restore();

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

rotateBtn.addEventListener('click', () => {
    // Increase rotation angle by 90 degrees
    rotationAngle = (rotationAngle + 90) % 360;
    liveView.style.transform = `rotate(${rotationAngle}deg)`;
    addDebugMessage(`Rotated to ${rotationAngle} degrees`);
});

// Function to apply constraints
function applyVideoConstraints() {
    if (videoTrack) {
        const exposureAuto = document.getElementById('exposure-auto').checked;
        const whiteBalanceAuto = document.getElementById('white-balance-auto').checked;
        const focusAuto = document.getElementById('focus-auto').checked;

        const sliderValue = parseFloat(document.getElementById('exposure-control').value);
        const exposureValue = (sliderValue - 127.5) / 12.75; // Convert to -10 to 10 range
        const brightnessValue = sliderValue; // Use 0 to 255 range directly
        const whiteBalanceValue = parseInt(document.getElementById('white-balance-control').value);
        const focusValue = parseInt(document.getElementById('focus-control').value);

        const constraints = {
            advanced: [
                exposureAuto ? { exposureMode: 'continuous' } : { exposureCompensation: exposureValue, brightness: brightnessValue },
                whiteBalanceAuto ? { whiteBalanceMode: 'continuous' } : { whiteBalanceMode: 'manual', colorTemperature: whiteBalanceValue },
                focusAuto ? { focusMode: 'continuous' } : { focusDistance: focusValue }
            ]
        };

        videoTrack.applyConstraints(constraints)
            .then(() => addDebugMessage(`Constraints applied: Exposure/Brightness ${exposureValue}, White Balance ${whiteBalanceValue}, Focus ${focusValue}`))
            .catch(err => addDebugMessage(`Error applying constraints: ${err}`));
    }
}

function updateControlValue(controlId, valueId) {
    const control = document.getElementById(controlId);
    const value = document.getElementById(valueId);
    value.textContent = control.value;
    applyVideoConstraints();
}

// Add event listeners for the sliders
document.getElementById('exposure-control').addEventListener('input', () => updateControlValue('exposure-control', 'exposure-value'));
document.getElementById('white-balance-control').addEventListener('input', () => updateControlValue('white-balance-control', 'white-balance-value'));
document.getElementById('focus-control').addEventListener('input', () => updateControlValue('focus-control', 'focus-value'));

// Add event listeners for the auto checkboxes
document.getElementById('exposure-auto').addEventListener('change', applyVideoConstraints);
document.getElementById('white-balance-auto').addEventListener('change', applyVideoConstraints);
document.getElementById('focus-auto').addEventListener('change', applyVideoConstraints);

// Add event listeners for the buttons
document.getElementById('exposure-decrease').addEventListener('click', () => {
    const control = document.getElementById('exposure-control');
    control.stepDown();
    updateControlValue('exposure-control', 'exposure-value');
});

document.getElementById('exposure-increase').addEventListener('click', () => {
    const control = document.getElementById('exposure-control');
    control.stepUp();
    updateControlValue('exposure-control', 'exposure-value');
});

document.getElementById('white-balance-decrease').addEventListener('click', () => {
    const control = document.getElementById('white-balance-control');
    control.stepDown();
    updateControlValue('white-balance-control', 'white-balance-value');
});

document.getElementById('white-balance-increase').addEventListener('click', () => {
    const control = document.getElementById('white-balance-control');
    control.stepUp();
    updateControlValue('white-balance-control', 'white-balance-value');
});

document.getElementById('focus-decrease').addEventListener('click', () => {
    const control = document.getElementById('focus-control');
    control.stepDown();
    updateControlValue('focus-control', 'focus-value');
});

document.getElementById('focus-increase').addEventListener('click', () => {
    const control = document.getElementById('focus-control');
    control.stepUp();
    updateControlValue('focus-control', 'focus-value');
});

