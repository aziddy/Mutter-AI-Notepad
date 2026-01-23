#!/bin/bash
# Setup script for WhisperX diarization environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/venv"

echo "========================================"
echo "WhisperX Diarization Environment Setup"
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

# Install PyTorch (platform-aware)
echo ""
if [[ "$(uname -s)" == "Darwin" ]]; then
    # macOS - use default PyTorch which includes MPS support for Apple Silicon
    echo "Installing PyTorch with MPS support (macOS)..."
    pip install torch torchaudio
else
    # Linux/Windows - use CPU version (user can reinstall with CUDA if needed)
    echo "Installing PyTorch (CPU version)..."
    pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

# Install WhisperX
echo ""
echo "Installing WhisperX..."
pip install whisperx

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
echo "  4. Create token at https://huggingface.co/settings/tokens"
echo "  5. Add token to .env file in project root:"
echo "     cp .env.example .env"
echo "     # Then edit .env and set HF_TOKEN=your_token"
echo ""
echo "For GPU support (faster processing), reinstall PyTorch with CUDA:"
echo "  source $VENV_DIR/bin/activate"
echo "  pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118"
echo ""
