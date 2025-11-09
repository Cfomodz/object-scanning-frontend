from flask import Flask, render_template, jsonify, request
from camera_v4l2 import camera_control
from profile_manager import profile_manager

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/camera/controls', methods=['GET'])
def get_camera_controls():
    """Get all available camera controls"""
    try:
        controls = camera_control.get_controls_for_ui()
        return jsonify({
            'success': True,
            'controls': controls
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/camera/control/<control_name>', methods=['GET'])
def get_single_control(control_name):
    """Get value of a specific control"""
    try:
        value = camera_control.get_control(control_name)
        return jsonify({
            'success': True,
            'control': control_name,
            'value': value
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/camera/control/<control_name>', methods=['POST'])
def set_single_control(control_name):
    """Set value of a specific control"""
    try:
        data = request.get_json()
        value = data.get('value')
        
        if value is None:
            return jsonify({
                'success': False,
                'error': 'Value is required'
            }), 400
        
        success = camera_control.set_control(control_name, value)
        return jsonify({
            'success': success,
            'control': control_name,
            'value': value
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/camera/controls/batch', methods=['POST'])
def set_multiple_controls():
    """Set multiple controls at once"""
    try:
        data = request.get_json()
        controls = data.get('controls', {})
        
        results = camera_control.set_multiple_controls(controls)
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/camera/controls/reset', methods=['POST'])
def reset_controls():
    """Reset all controls to defaults"""
    try:
        success = camera_control.reset_to_defaults()
        return jsonify({
            'success': success
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/profiles', methods=['GET'])
def list_profiles():
    """List all saved profiles"""
    try:
        profiles = profile_manager.list_profiles()
        return jsonify({
            'success': True,
            'profiles': profiles
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/profiles/<profile_name>', methods=['GET'])
def get_profile(profile_name):
    """Load a specific profile"""
    try:
        profile = profile_manager.load_profile(profile_name)
        if profile is None:
            return jsonify({
                'success': False,
                'error': 'Profile not found'
            }), 404
        
        return jsonify({
            'success': True,
            'profile': profile
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/profiles/<profile_name>', methods=['POST'])
def save_profile(profile_name):
    """Save a profile"""
    try:
        data = request.get_json()
        settings = data.get('settings', {})
        
        success = profile_manager.save_profile(profile_name, settings)
        return jsonify({
            'success': success
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/profiles/<profile_name>', methods=['DELETE'])
def delete_profile(profile_name):
    """Delete a profile"""
    try:
        success = profile_manager.delete_profile(profile_name)
        return jsonify({
            'success': success
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
