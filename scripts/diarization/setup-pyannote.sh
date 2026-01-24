#!/bin/bash
# Setup script for pyannote.audio speaker diarization
# This is a lean setup - only installs pyannote.audio (no WhisperX)
# Transcription is handled by whisper.cpp (Metal GPU accelerated)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

echo "========================================"
echo "Pyannote Speaker Diarization Setup"
echo "========================================"
echo ""

# Check for Python 3
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not found."
    echo "Please install Python 3.9+ and try again."
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
echo "Found Python: $PYTHON_VERSION"

# Create virtual environment
echo ""
echo "Creating virtual environment at: $VENV_DIR"
python3 -m venv "$VENV_DIR"

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip

# Install PyTorch
echo ""
echo "Installing PyTorch..."
pip install torch torchaudio

# Install pyannote.audio (standalone - no WhisperX needed)
echo ""
echo "Installing pyannote.audio..."
pip install pyannote.audio

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Virtual environment created at: $VENV_DIR"
echo ""
echo "IMPORTANT: For speaker diarization, you need a Hugging Face token."
echo ""
echo "Setup steps:"
echo "  1. Create account at https://huggingface.co"
echo "  2. Accept terms at https://huggingface.co/pyannote/speaker-diarization-3.1"
echo "  3. Accept terms at https://huggingface.co/pyannote/segmentation-3.0"
echo "  4. Accept terms at https://huggingface.co/pyannote/speaker-diarization-community-1"
echo "  5. Create token at https://huggingface.co/settings/tokens"
echo "  6. Add token to .env file in project root:"
echo "     HF_TOKEN=your_token_here"
echo ""
