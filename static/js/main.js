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
const resolutionSelect = document.getElementById('resolution-select');

let capturing = true;
let motionDetected = false;
let motionTimeout = null;
let detectingMotion = false; // To prevent multiple concurrent detectMotion calls
let rotationAngle = 0; // Rotation angle in degrees
let videoTrack;
let currentResolution = { width: 640, height: 480 };

function addDebugMessage(message) {
    const timestamp = new Date().toLocaleTimeString();
    const msgElement = document.createElement('div');
    msgElement.textContent = `[${timestamp}] ${message}`;
    
    // Prepend the new message to the top of the debug log
    debugLog.insertBefore(msgElement, debugLog.firstChild);
}

function startWebcam(deviceId, width, height) {
    const constraints = {
        video: {
            width: width ? { ideal: width } : { max: 1920 },
            height: height ? { ideal: height } : { max: 1080 },
            deviceId: deviceId ? { exact: deviceId } : undefined
        }
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            liveView.srcObject = stream;
            videoTrack = stream.getVideoTracks()[0]; // Store the video track
            liveView.onloadedmetadata = () => {
                liveView.play();
                const actualSettings = videoTrack.getSettings();
                addDebugMessage(`Webcam started at ${actualSettings.width}x${actualSettings.height}`);
                // Query and apply camera capabilities
                queryCameraCapabilities();
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

// Add event listener for resolution selector
resolutionSelect.addEventListener('change', () => {
    const resolution = resolutionSelect.value;
    const [width, height] = resolution.split('x').map(Number);
    currentResolution = { width, height };
    
    addDebugMessage(`Changing resolution to ${width}x${height}...`);
    
    // Stop current stream
    if (liveView.srcObject) {
        liveView.srcObject.getTracks().forEach(track => track.stop());
        liveView.srcObject = null;
        detectingMotion = false;
    }
    
    // Restart with new resolution
    setTimeout(() => {
        startWebcam(null, width, height);
    }, 100);
});

// Add event listener for refresh settings button
const refreshSettingsBtn = document.getElementById('refresh-settings-btn');
refreshSettingsBtn.addEventListener('click', () => {
    addDebugMessage('Refreshing camera settings...');
    queryCameraCapabilities();
});

// Function to query camera capabilities and dynamically create UI controls
function queryCameraCapabilities() {
    if (!videoTrack) {
        addDebugMessage('No video track available for querying capabilities');
        return;
    }

    const capabilities = videoTrack.getCapabilities();
    addDebugMessage('Browser camera capabilities retrieved');
    console.log('Browser camera capabilities:', capabilities);
    
    // Log all available capability keys
    const capabilityKeys = Object.keys(capabilities);
    addDebugMessage(`Browser API capabilities: ${capabilityKeys.join(', ')}`);
    
    // Log detailed info about each capability
    capabilityKeys.forEach(key => {
        const value = capabilities[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            addDebugMessage(`  ${key}: {min: ${value.min}, max: ${value.max}, step: ${value.step}}`);
        } else {
            addDebugMessage(`  ${key}: ${JSON.stringify(value)}`);
        }
    });

    // Clear existing dynamic controls container
    const controlsContainer = document.getElementById('dynamic-controls');
    if (!controlsContainer) {
        addDebugMessage('Error: dynamic-controls container not found');
        return;
    }
    controlsContainer.innerHTML = '';

    // Fetch V4L2 controls from Flask backend
    addDebugMessage('Fetching V4L2 camera controls from backend...');
    fetch('/api/camera/controls')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                addDebugMessage('V4L2 controls received successfully');
                createV4L2Controls(controlsContainer, data.controls);
            } else {
                addDebugMessage(`Error fetching V4L2 controls: ${data.error}`);
                showNoControlsMessage(controlsContainer, capabilityKeys);
            }
        })
        .catch(error => {
            addDebugMessage(`Failed to fetch V4L2 controls: ${error.message}`);
            showNoControlsMessage(controlsContainer, capabilityKeys);
        });

    // Get current settings
    const settings = videoTrack.getSettings();
    addDebugMessage(`Current settings: ${JSON.stringify(settings)}`);
}

// Function to create V4L2 controls
function createV4L2Controls(container, controls) {
    let totalControls = 0;
    
    // Create imaging controls section
    if (controls.imaging && controls.imaging.length > 0) {
        const imagingSection = document.createElement('div');
        imagingSection.className = 'controls-section';
        
        const imagingHeader = document.createElement('h3');
        imagingHeader.textContent = 'Imaging Controls';
        imagingHeader.className = 'controls-section-header';
        imagingSection.appendChild(imagingHeader);
        
        controls.imaging.forEach(ctrl => {
            if (ctrl.type === 'bool') {
                imagingSection.appendChild(createBooleanControl(ctrl));
            } else if (ctrl.type === 'menu') {
                imagingSection.appendChild(createMenuControl(ctrl));
            } else {
                imagingSection.appendChild(createSliderControl(ctrl));
            }
            totalControls++;
        });
        
        container.appendChild(imagingSection);
    }
    
    // Create camera controls section
    if (controls.camera && controls.camera.length > 0) {
        const cameraSection = document.createElement('div');
        cameraSection.className = 'controls-section';
        
        const cameraHeader = document.createElement('h3');
        cameraHeader.textContent = 'Camera Controls';
        cameraHeader.className = 'controls-section-header';
        cameraSection.appendChild(cameraHeader);
        
        controls.camera.forEach(ctrl => {
            if (ctrl.type === 'bool') {
                cameraSection.appendChild(createBooleanControl(ctrl));
            } else if (ctrl.type === 'menu') {
                cameraSection.appendChild(createMenuControl(ctrl));
            } else {
                cameraSection.appendChild(createSliderControl(ctrl));
            }
            totalControls++;
        });
        
        container.appendChild(cameraSection);
    }
    
    if (totalControls === 0) {
        showNoControlsMessage(container, []);
    } else {
        addDebugMessage(`Created ${totalControls} camera controls`);
        
        // Add reset button
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset All to Defaults';
        resetBtn.className = 'btn reset-controls-btn';
        resetBtn.addEventListener('click', resetAllControls);
        container.appendChild(resetBtn);
    }
}

// Create a slider control
function createSliderControl(ctrl) {
    const controlDiv = document.createElement('div');
    controlDiv.className = 'control-group';
    controlDiv.id = `${ctrl.key}-group`;
    
    if (ctrl.inactive) {
        controlDiv.classList.add('control-group-inactive');
    }

    // Create label
    const label = document.createElement('label');
    label.textContent = `${ctrl.label}:`;
    label.htmlFor = `${ctrl.key}-control`;
    if (ctrl.inactive) {
        label.textContent += ' (inactive)';
    }
    controlDiv.appendChild(label);

    // Create decrease button
    const decreaseBtn = document.createElement('button');
    decreaseBtn.textContent = '-';
    decreaseBtn.id = `${ctrl.key}-decrease`;
    decreaseBtn.className = 'control-btn';
    decreaseBtn.disabled = ctrl.inactive;
    controlDiv.appendChild(decreaseBtn);

    // Create slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = `${ctrl.key}-control`;
    slider.className = 'control-slider';
    slider.min = ctrl.min;
    slider.max = ctrl.max;
    slider.step = ctrl.step;
    slider.value = ctrl.value;
    slider.disabled = ctrl.inactive;
    slider.dataset.controlKey = ctrl.key;
    controlDiv.appendChild(slider);

    // Create increase button
    const increaseBtn = document.createElement('button');
    increaseBtn.textContent = '+';
    increaseBtn.id = `${ctrl.key}-increase`;
    increaseBtn.className = 'control-btn';
    increaseBtn.disabled = ctrl.inactive;
    controlDiv.appendChild(increaseBtn);

    // Create value display
    const valueSpan = document.createElement('span');
    valueSpan.id = `${ctrl.key}-value`;
    valueSpan.className = 'control-value';
    valueSpan.textContent = ctrl.value;
    controlDiv.appendChild(valueSpan);

    // Add event listeners
    slider.addEventListener('input', () => {
        valueSpan.textContent = slider.value;
    });
    
    slider.addEventListener('change', () => {
        applyV4L2Control(ctrl.key, parseInt(slider.value));
    });

    decreaseBtn.addEventListener('click', () => {
        slider.stepDown();
        valueSpan.textContent = slider.value;
        applyV4L2Control(ctrl.key, parseInt(slider.value));
    });

    increaseBtn.addEventListener('click', () => {
        slider.stepUp();
        valueSpan.textContent = slider.value;
        applyV4L2Control(ctrl.key, parseInt(slider.value));
    });

    return controlDiv;
}

// Create a boolean control (checkbox)
function createBooleanControl(ctrl) {
    const controlDiv = document.createElement('div');
    controlDiv.className = 'control-group control-group-checkbox';
    controlDiv.id = `${ctrl.key}-group`;

    // Create checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${ctrl.key}-control`;
    checkbox.className = 'control-checkbox';
    checkbox.checked = ctrl.value === 1 || ctrl.value === true;
    checkbox.disabled = ctrl.inactive;
    checkbox.dataset.controlKey = ctrl.key;
    controlDiv.appendChild(checkbox);

    // Create label
    const label = document.createElement('label');
    label.textContent = ctrl.label;
    if (ctrl.inactive) {
        label.textContent += ' (inactive)';
    }
    label.htmlFor = `${ctrl.key}-control`;
    label.className = 'control-checkbox-label';
    controlDiv.appendChild(label);

    // Add event listener
    checkbox.addEventListener('change', () => {
        applyV4L2Control(ctrl.key, checkbox.checked ? 1 : 0);
    });

    return controlDiv;
}

// Create a menu control (dropdown)
function createMenuControl(ctrl) {
    const controlDiv = document.createElement('div');
    controlDiv.className = 'control-group control-group-menu';
    controlDiv.id = `${ctrl.key}-group`;

    // Create label
    const label = document.createElement('label');
    label.textContent = `${ctrl.label}:`;
    label.htmlFor = `${ctrl.key}-control`;
    controlDiv.appendChild(label);

    // Create dropdown
    const select = document.createElement('select');
    select.id = `${ctrl.key}-control`;
    select.className = 'control-select';
    select.disabled = ctrl.inactive;
    select.dataset.controlKey = ctrl.key;

    // Add options
    if (ctrl.options && ctrl.options.length > 0) {
        ctrl.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            if (option.value === ctrl.value) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });
    }

    controlDiv.appendChild(select);

    // Add event listener
    select.addEventListener('change', () => {
        const value = parseInt(select.value);
        applyV4L2Control(ctrl.key, value);
        
        // Refresh controls after changing (especially for auto_exposure)
        if (ctrl.key === 'auto_exposure') {
            setTimeout(() => {
                queryCameraCapabilities();
            }, 500);
        }
    });

    return controlDiv;
}

// Apply a V4L2 control via Flask backend
function applyV4L2Control(controlName, value) {
    addDebugMessage(`Setting ${controlName} to ${value}`);
    
    fetch(`/api/camera/control/${controlName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: value })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            addDebugMessage(`${controlName} set successfully to ${value}`);
        } else {
            addDebugMessage(`Error setting ${controlName}: ${data.error}`);
        }
    })
    .catch(error => {
        addDebugMessage(`Failed to set ${controlName}: ${error.message}`);
    });
}

// Reset all controls to defaults
function resetAllControls() {
    addDebugMessage('Resetting all controls to defaults...');
    
    fetch('/api/camera/controls/reset', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            addDebugMessage('All controls reset to defaults');
            queryCameraCapabilities(); // Refresh the UI
        } else {
            addDebugMessage(`Error resetting controls: ${data.error}`);
        }
    })
    .catch(error => {
        addDebugMessage(`Failed to reset controls: ${error.message}`);
    });
}

// Show "no controls" message
function showNoControlsMessage(container, capabilityKeys) {
    const noControlsMsg = document.createElement('div');
    noControlsMsg.className = 'no-controls-message';
    
    if (capabilityKeys.length > 0) {
        noControlsMsg.innerHTML = `
            <p><strong>No hardware camera controls available.</strong></p>
            <p>Browser API only exposes: ${capabilityKeys.join(', ')}</p>
            <p>Note: Most webcams don't expose imaging controls through the browser or Linux V4L2 APIs. You may need to use manufacturer-specific software.</p>
        `;
    } else {
        noControlsMsg.innerHTML = `
            <p><strong>No adjustable camera controls available.</strong></p>
            <p>This camera doesn't expose hardware controls through the V4L2 API.</p>
        `;
    }
    
    container.appendChild(noControlsMsg);
}

// Helper function to get the auto mode key for a capability
function getAutoModeKey(capabilityKey) {
    const modeMapping = {
        'exposureCompensation': 'exposureMode',
        'focusDistance': 'focusMode',
        'colorTemperature': 'whiteBalanceMode'
    };
    return modeMapping[capabilityKey];
}

// ===== PROFILE MANAGEMENT =====

// Load list of profiles
function loadProfileList() {
    fetch('/api/profiles')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const profileSelect = document.getElementById('profile-select');
                // Clear existing options except the first
                profileSelect.innerHTML = '<option value="">-- Select Profile --</option>';
                
                data.profiles.forEach(profile => {
                    const option = document.createElement('option');
                    option.value = profile;
                    option.textContent = profile;
                    profileSelect.appendChild(option);
                });
                
                addDebugMessage(`Loaded ${data.profiles.length} profiles`);
            }
        })
        .catch(error => {
            addDebugMessage(`Error loading profiles: ${error.message}`);
        });
}

// Get current settings
function getCurrentSettings() {
    const settings = {
        resolution: resolutionSelect.value,
        rotation: rotationAngle,
        v4l2_controls: {}
    };
    
    // Get all V4L2 control values
    const controls = document.querySelectorAll('[data-control-key]');
    controls.forEach(control => {
        const key = control.dataset.controlKey;
        let value;
        
        if (control.type === 'checkbox') {
            value = control.checked ? 1 : 0;
        } else if (control.type === 'select-one') {
            value = parseInt(control.value);
        } else {
            value = parseInt(control.value);
        }
        
        settings.v4l2_controls[key] = value;
    });
    
    return settings;
}

// Save profile
document.getElementById('save-profile-btn').addEventListener('click', () => {
    const profileName = document.getElementById('profile-name').value.trim();
    
    if (!profileName) {
        addDebugMessage('Please enter a profile name');
        return;
    }
    
    const settings = getCurrentSettings();
    addDebugMessage(`Saving profile "${profileName}"...`);
    
    fetch(`/api/profiles/${encodeURIComponent(profileName)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings: settings })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            addDebugMessage(`Profile "${profileName}" saved successfully`);
            document.getElementById('profile-name').value = '';
            loadProfileList(); // Refresh the profile list
        } else {
            addDebugMessage(`Error saving profile: ${data.error}`);
        }
    })
    .catch(error => {
        addDebugMessage(`Failed to save profile: ${error.message}`);
    });
});

// Load profile
document.getElementById('load-profile-btn').addEventListener('click', () => {
    const profileName = document.getElementById('profile-select').value;
    
    if (!profileName) {
        addDebugMessage('Please select a profile to load');
        return;
    }
    
    addDebugMessage(`Loading profile "${profileName}"...`);
    
    fetch(`/api/profiles/${encodeURIComponent(profileName)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                applyProfile(data.profile);
                addDebugMessage(`Profile "${profileName}" loaded successfully`);
            } else {
                addDebugMessage(`Error loading profile: ${data.error}`);
            }
        })
        .catch(error => {
            addDebugMessage(`Failed to load profile: ${error.message}`);
        });
});

// Apply profile settings
function applyProfile(settings) {
    // Apply resolution if different
    if (settings.resolution && settings.resolution !== resolutionSelect.value) {
        resolutionSelect.value = settings.resolution;
        const [width, height] = settings.resolution.split('x').map(Number);
        
        // Stop current stream
        if (liveView.srcObject) {
            liveView.srcObject.getTracks().forEach(track => track.stop());
            liveView.srcObject = null;
            detectingMotion = false;
        }
        
        // Restart with new resolution
        setTimeout(() => {
            startWebcam(null, width, height);
            // Apply V4L2 controls after stream starts
            setTimeout(() => {
                applyV4L2Controls(settings.v4l2_controls);
            }, 1000);
        }, 100);
    } else {
        // Just apply V4L2 controls
        applyV4L2Controls(settings.v4l2_controls);
    }
    
    // Apply rotation
    if (settings.rotation !== undefined) {
        rotationAngle = settings.rotation;
        liveView.style.transform = `rotate(${rotationAngle}deg)`;
    }
}

// Apply multiple V4L2 controls
function applyV4L2Controls(controls) {
    if (!controls) return;
    
    Object.entries(controls).forEach(([key, value]) => {
        applyV4L2Control(key, value);
    });
    
    // Refresh UI after a delay
    setTimeout(() => {
        queryCameraCapabilities();
    }, 500);
}

// Delete profile
document.getElementById('delete-profile-btn').addEventListener('click', () => {
    const profileName = document.getElementById('profile-select').value;
    
    if (!profileName) {
        addDebugMessage('Please select a profile to delete');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete profile "${profileName}"?`)) {
        return;
    }
    
    addDebugMessage(`Deleting profile "${profileName}"...`);
    
    fetch(`/api/profiles/${encodeURIComponent(profileName)}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            addDebugMessage(`Profile "${profileName}" deleted successfully`);
            loadProfileList(); // Refresh the profile list
        } else {
            addDebugMessage(`Error deleting profile: ${data.error}`);
        }
    })
    .catch(error => {
        addDebugMessage(`Failed to delete profile: ${error.message}`);
    });
});

// Load profile list on page load
window.addEventListener('DOMContentLoaded', () => {
    loadProfileList();
});

