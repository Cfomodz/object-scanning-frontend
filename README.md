# Object Scanner

A lightweight, zero-dependency web application for semi-autonomous image capturing using motion detection. This pure JavaScript solution runs entirely in your browser with no backend server required.

![image](https://github.com/user-attachments/assets/4e4d5194-5c61-421f-b505-e313ed416663)

## Features

- **Motion Detection**: Automatically captures images when motion stops using OpenCV.js
- **Automatic Image Download**: Captured images are automatically saved to your downloads folder
- **Live Preview**: Real-time webcam feed with last captured image display
- **Image Rotation**: Rotate camera view in 90° increments
- **Advanced Camera Controls**: 
  - Exposure/Brightness adjustment (manual or auto)
  - White balance control (2000K - 10000K)
  - Focus control (manual or auto)
- **Debug Console**: Real-time logging of all detection events and system status
- **Responsive Design**: Works on desktop and mobile devices
- **OS Agnostic**: Runs on Windows, macOS, Linux, Android, iOS - anywhere with a modern browser

## Quick Start

**No installation required!** Simply open `index.html` in any modern web browser:

```bash
# On Linux/Mac
open index.html

# Or just double-click the file in your file manager
```

That's it! The application will request camera permissions and start immediately.

## Requirements

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A webcam/camera
- Internet connection (for OpenCV.js CDN - loaded automatically)

## Usage

1. **Grant Camera Access**: Allow the browser to access your webcam when prompted
2. **Position Objects**: Place objects in view of the camera
3. **Automatic Capture**: The system detects motion and captures an image 1.35 seconds after motion stops
4. **Manual Controls**:
   - **Stop/Start Capture**: Toggle motion detection on/off
   - **Rotate**: Rotate the camera view if mounted at an angle
   - **Adjust Settings**: Fine-tune exposure, white balance, and focus for optimal image quality

## How It Works

The application uses:
- **MediaDevices API** for webcam access
- **OpenCV.js** for real-time motion detection via frame differencing
- **Canvas API** for image capture and rotation
- **Download API** for automatic file saving

Motion is detected by comparing consecutive frames. When motion stops for 1.35 seconds, an image is automatically captured at full camera resolution and downloaded.

## Technical Details

- **Single File**: Entire application in one HTML file (~13KB)
- **No Backend**: Pure frontend - no server, no build process
- **No Dependencies**: Everything runs in-browser
- **Privacy First**: All processing happens locally, no data sent to servers

## Browser Compatibility

Works on all modern browsers that support:
- `getUserMedia()` API
- HTML5 Canvas
- ES6 JavaScript

Tested on Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## License

This project is licensed under the GNU Lesser General Public License v2.1. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## Acknowledgments

- This project uses [OpenCV.js](https://docs.opencv.org/4.x/opencv.js) for image processing
- Special thanks to the contributors and the open-source community

---

**Note**: This is the pure JavaScript version. For the original Flask-based version, see the `main` branch.
