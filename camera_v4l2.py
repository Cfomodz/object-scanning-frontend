"""
V4L2 Camera Control Module
Provides interface to query and set camera controls via v4l2-ctl
"""

import subprocess
import re
import json
from typing import Dict, List, Any, Optional


class V4L2CameraControl:
    def __init__(self, device="/dev/video5"):
        self.device = device
        
    def _run_v4l2_command(self, args: List[str]) -> str:
        """Run v4l2-ctl command and return output"""
        try:
            cmd = ["v4l2-ctl", "-d", self.device] + args
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return result.stdout
        except subprocess.CalledProcessError as e:
            raise Exception(f"v4l2-ctl error: {e.stderr}")
        except FileNotFoundError:
            raise Exception("v4l2-ctl not found. Please install v4l-utils package.")
    
    def list_controls(self) -> Dict[str, Any]:
        """Get all available controls with their current values and constraints"""
        output = self._run_v4l2_command(["--list-ctrls"])
        controls = {}
        
        # Parse the output
        lines = output.strip().split('\n')
        current_section = None
        
        for line in lines:
            # Section headers (e.g., "User Controls", "Camera Controls")
            if line.strip() and not line.startswith(' '):
                current_section = line.strip()
                continue
            
            # Control lines (indented)
            if line.startswith(' ') and '0x' in line:
                parsed = self._parse_control_line(line)
                if parsed:
                    parsed['section'] = current_section
                    controls[parsed['name']] = parsed
        
        return controls
    
    def _parse_control_line(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse a single control line from v4l2-ctl output"""
        # Example formats:
        # brightness 0x00980900 (int)    : min=-64 max=64 step=1 default=0 value=7
        # white_balance_automatic 0x0098090c (bool)   : default=1 value=1
        # auto_exposure 0x009a0901 (menu)   : min=0 max=3 default=3 value=3 (Aperture Priority Mode)
        
        match = re.match(r'\s+(\w+)\s+(0x[0-9a-f]+)\s+\((\w+)\)\s+:\s+(.+)', line)
        if not match:
            return None
        
        name, hex_id, ctrl_type, params = match.groups()
        
        control = {
            'name': name,
            'id': hex_id,
            'type': ctrl_type,
            'min': None,
            'max': None,
            'step': None,
            'default': None,
            'value': None,
            'flags': [],
            'options': []
        }
        
        # Parse parameters
        param_pattern = r'(\w+)=(-?\d+(?:\.\d+)?)'
        for key, value in re.findall(param_pattern, params):
            if key in ['min', 'max', 'step', 'default', 'value']:
                control[key] = int(value) if '.' not in value else float(value)
        
        # Check for flags (e.g., "flags=inactive")
        flags_match = re.search(r'flags=(\w+(?:,\w+)*)', params)
        if flags_match:
            control['flags'] = flags_match.group(1).split(',')
        
        # Parse menu options if present (in parentheses at the end)
        menu_match = re.search(r'\(([^)]+)\)$', params)
        if menu_match and ctrl_type == 'menu':
            control['current_option'] = menu_match.group(1)
        
        return control
    
    def get_control(self, control_name: str) -> Optional[int]:
        """Get the current value of a specific control"""
        try:
            output = self._run_v4l2_command(["--get-ctrl", control_name])
            match = re.search(r':\s*(-?\d+)', output)
            if match:
                return int(match.group(1))
        except:
            pass
        return None
    
    def set_control(self, control_name: str, value: Any) -> bool:
        """Set a control to a specific value"""
        try:
            self._run_v4l2_command(["--set-ctrl", f"{control_name}={value}"])
            return True
        except Exception as e:
            print(f"Error setting {control_name}: {e}")
            return False
    
    def set_multiple_controls(self, controls: Dict[str, Any]) -> Dict[str, bool]:
        """Set multiple controls at once"""
        results = {}
        for name, value in controls.items():
            results[name] = self.set_control(name, value)
        return results
    
    def reset_to_defaults(self) -> bool:
        """Reset all controls to their default values"""
        try:
            controls = self.list_controls()
            for name, ctrl in controls.items():
                if ctrl['default'] is not None:
                    self.set_control(name, ctrl['default'])
            return True
        except:
            return False
    
    def get_controls_for_ui(self) -> Dict[str, Any]:
        """Get controls formatted for UI display"""
        all_controls = self.list_controls()
        ui_controls = {
            'imaging': [],
            'camera': []
        }
        
        for name, ctrl in all_controls.items():
            # Check if inactive
            is_inactive = 'inactive' in ctrl['flags']
            
            # Skip read-only controls
            if 'read-only' in ctrl['flags']:
                continue
            
            # Handle integer/int64 controls (sliders)
            if ctrl['type'] in ['int', 'int64'] and ctrl['min'] is not None and ctrl['max'] is not None:
                ui_ctrl = {
                    'key': name,
                    'label': name.replace('_', ' ').title(),
                    'type': ctrl['type'],
                    'min': ctrl['min'],
                    'max': ctrl['max'],
                    'step': ctrl['step'] if ctrl['step'] else 1,
                    'value': ctrl['value'],
                    'default': ctrl['default'],
                    'inactive': is_inactive
                }
                
                # Categorize based on section
                if ctrl['section'] == 'Camera Controls':
                    ui_controls['camera'].append(ui_ctrl)
                else:
                    ui_controls['imaging'].append(ui_ctrl)
            
            # Handle boolean controls (checkboxes)
            elif ctrl['type'] == 'bool':
                ui_ctrl = {
                    'key': name,
                    'label': name.replace('_', ' ').title(),
                    'type': 'bool',
                    'value': ctrl['value'],
                    'default': ctrl['default'],
                    'inactive': is_inactive
                }
                
                if ctrl['section'] == 'Camera Controls':
                    ui_controls['camera'].append(ui_ctrl)
                else:
                    ui_controls['imaging'].append(ui_ctrl)
            
            # Handle menu controls (dropdowns)
            elif ctrl['type'] == 'menu':
                # Get menu options
                menu_options = self._get_menu_options(name)
                
                ui_ctrl = {
                    'key': name,
                    'label': name.replace('_', ' ').title(),
                    'type': 'menu',
                    'value': ctrl['value'],
                    'default': ctrl['default'],
                    'min': ctrl['min'],
                    'max': ctrl['max'],
                    'options': menu_options,
                    'inactive': is_inactive
                }
                
                if ctrl['section'] == 'Camera Controls':
                    ui_controls['camera'].append(ui_ctrl)
                else:
                    ui_controls['imaging'].append(ui_ctrl)
        
        return ui_controls
    
    def _get_menu_options(self, control_name: str) -> List[Dict[str, Any]]:
        """Get menu options for a menu-type control"""
        try:
            output = self._run_v4l2_command(["--list-ctrls-menus"])
            lines = output.strip().split('\n')
            
            options = []
            capture = False
            
            for line in lines:
                # Start capturing when we find the control
                if control_name in line and '(menu)' in line:
                    capture = True
                    continue
                
                # Stop when we hit another control
                if capture and line.strip() and not line.startswith('\t'):
                    break
                
                # Parse menu items (indented lines with index: value format)
                if capture and line.startswith('\t'):
                    # Format: "\t0: Manual Mode" or "\t1: Auto Mode"
                    match = re.match(r'\s+(\d+):\s*(.+)', line)
                    if match:
                        index, label = match.groups()
                        options.append({
                            'value': int(index),
                            'label': label.strip()
                        })
            
            return options
        except:
            return []


# Global instance
camera_control = V4L2CameraControl()

