# Object Scanning Frontend

A small Flask app with WebSocket support to aid in the semi-autonomous capturing of images and barcodes.

![image](https://github.com/user-attachments/assets/4e4d5194-5c61-421f-b505-e313ed416663)

## Features

- **Motion Detection**: Automatically detects motion to capture images.
- **Image Rotation**: Rotate images to the desired orientation.
- **Adjustable Camera Settings**: Control exposure, white balance, and focus.

## Requirements

- Python with Flask
- OpenCV.js for image processing

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd object-scanning-frontend
   ```

2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the Flask app:
   ```bash
   python app.py
   ```

4. Open your browser and navigate to `http://localhost:5000` to access the app.

## Usage

- **Start/Stop Capture**: Use the "Start Capture" button to begin capturing images. The button toggles to "Stop Capture" to pause the process.
- **Rotate**: Click the "Rotate" button to rotate the live view by 90 degrees.
- **Adjust Camera Settings**: Use the sliders and checkboxes to adjust exposure, white balance, and focus.

## License

This project is licensed under the GNU Lesser General Public License v2.1. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## Acknowledgments

- This project uses [OpenCV.js](https://docs.opencv.org/4.x/opencv.js) for image processing.
- Special thanks to the contributors and the open-source community.
