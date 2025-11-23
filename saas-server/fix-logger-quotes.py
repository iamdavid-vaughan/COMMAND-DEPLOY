#!/usr/bin/env python3
"""Fix logger calls with mixed quotes and backticks"""

import re
import glob
import os

def fix_logger_calls(file_path):
    """Fix logger calls that have template literals with wrong quotes"""
    with open(file_path, 'r') as f:
        content = f.read()

    original = content

    # Pattern: logger.info('...${ ... }`);
    # Should be: logger.info(`... ${ ... }`);
    # This pattern finds logger calls that start with ' but have ${ and end with `
    pattern = r"logger\.(info|warn|error)\('(\[.*?)\$\{([^}]+)\}`\);"
    replacement = r"logger.\1(`\2${\3}`);"
    content = re.sub(pattern, replacement, content)

    # Also fix ones with multiple template variables
    pattern2 = r"logger\.(info|warn|error)\('([^'`]+\$\{[^}]+\}[^`]*)`\);"
    replacement2 = r"logger.\1(`\2`);"
    content = re.sub(pattern2, replacement2, content)

    if content != original:
        with open(file_path, 'w') as f:
            f.write(content)
        return True
    return False

# Fix all JS files in routes and services
fixed_files = []
for pattern in ['routes/*.js', 'services/*.js']:
    for file_path in glob.glob(pattern):
        if fix_logger_calls(file_path):
            fixed_files.append(file_path)

if fixed_files:
    print(f"Fixed {len(fixed_files)} files:")
    for f in fixed_files:
        print(f"  - {f}")
else:
    print("No files needed fixing")
