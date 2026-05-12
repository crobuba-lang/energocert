#!/bin/bash
# Build script - installs python-docx
echo "Installing python-docx..."
pip3 install python-docx --break-system-packages --quiet 2>/dev/null || \
pip3 install python-docx --quiet 2>/dev/null || \
pip install python-docx --break-system-packages --quiet 2>/dev/null || \
pip install python-docx --quiet 2>/dev/null
python3 -c "from docx import Document; print('python-docx OK')" && echo "Build complete"
