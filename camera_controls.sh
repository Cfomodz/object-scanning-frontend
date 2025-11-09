#!/bin/bash
# Camera Control Helper Script
# Usage: ./camera_controls.sh [option] [value]

CAMERA_DEVICE="/dev/video5"  # HD USB CAMERA

# Function to show current settings
show_settings() {
    echo "Current Camera Settings:"
    v4l2-ctl -d $CAMERA_DEVICE --list-ctrls
}

# Function to show usage
usage() {
    echo "Camera Control Helper"
    echo ""
    echo "Usage: $0 [command] [value]"
    echo ""
    echo "Commands:"
    echo "  show                     - Show all current settings"
    echo "  brightness [value]       - Set brightness (-64 to 64)"
    echo "  contrast [value]         - Set contrast (0 to 95)"
    echo "  saturation [value]       - Set saturation (0 to 100)"
    echo "  sharpness [value]        - Set sharpness (0 to 7)"
    echo "  gain [value]             - Set gain (0 to 255)"
    echo "  gamma [value]            - Set gamma (64 to 300)"
    echo "  exposure [value]         - Set exposure time (1 to 10000)"
    echo "  exposure-auto            - Enable auto exposure"
    echo "  exposure-manual          - Disable auto exposure"
    echo "  focus [value]            - Set focus (0 to 1023)"
    echo "  focus-auto               - Enable auto focus"
    echo "  focus-manual             - Disable auto focus"
    echo "  zoom [value]             - Set zoom (0 to 60)"
    echo "  wb-auto                  - Enable auto white balance"
    echo "  wb-manual [value]        - Set white balance temp (2800 to 6500)"
    echo "  reset                    - Reset to defaults"
    echo ""
    echo "Example: $0 brightness 10"
    echo "Example: $0 focus-manual && $0 focus 512"
}

# Parse commands
case "$1" in
    show)
        show_settings
        ;;
    brightness)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=brightness=$2
        echo "Brightness set to $2"
        ;;
    contrast)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=contrast=$2
        echo "Contrast set to $2"
        ;;
    saturation)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=saturation=$2
        echo "Saturation set to $2"
        ;;
    sharpness)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=sharpness=$2
        echo "Sharpness set to $2"
        ;;
    gain)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=gain=$2
        echo "Gain set to $2"
        ;;
    gamma)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=gamma=$2
        echo "Gamma set to $2"
        ;;
    exposure)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=exposure_time_absolute=$2
        echo "Exposure time set to $2"
        ;;
    exposure-auto)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=auto_exposure=3
        echo "Auto exposure enabled"
        ;;
    exposure-manual)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=auto_exposure=1
        echo "Manual exposure enabled"
        ;;
    focus)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=focus_absolute=$2
        echo "Focus set to $2"
        ;;
    focus-auto)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=focus_automatic_continuous=1
        echo "Auto focus enabled"
        ;;
    focus-manual)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=focus_automatic_continuous=0
        echo "Manual focus enabled"
        ;;
    zoom)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=zoom_absolute=$2
        echo "Zoom set to $2"
        ;;
    wb-auto)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=white_balance_automatic=1
        echo "Auto white balance enabled"
        ;;
    wb-manual)
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=white_balance_automatic=0
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=white_balance_temperature=$2
        echo "Manual white balance set to $2K"
        ;;
    reset)
        echo "Resetting camera to defaults..."
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=brightness=0
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=contrast=1
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=saturation=60
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=sharpness=0
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=gamma=100
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=gain=100
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=auto_exposure=3
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=focus_automatic_continuous=1
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=white_balance_automatic=1
        v4l2-ctl -d $CAMERA_DEVICE --set-ctrl=zoom_absolute=0
        echo "Camera reset to defaults"
        ;;
    *)
        usage
        exit 1
        ;;
esac

