#!/bin/bash
# Setup script for FluidAudio (macOS only)
# Fast speaker diarization using CoreML/Apple Neural Engine

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLUIDAUDIO_DIR="$SCRIPT_DIR/FluidAudio"

echo "========================================"
echo "  FluidAudio Setup"
echo "========================================"
echo ""

# Check if macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "Error: FluidAudio is only available on macOS"
    exit 1
fi

# Check for Xcode command line tools
if ! xcode-select -p &> /dev/null; then
    echo "Error: Xcode command line tools not installed"
    echo "Run: xcode-select --install"
    exit 1
fi

# Clone or update FluidAudio
if [ -d "$FLUIDAUDIO_DIR" ]; then
    echo "FluidAudio directory exists, updating..."
    cd "$FLUIDAUDIO_DIR"
    git pull
else
    echo "Cloning FluidAudio..."
    git clone https://github.com/FluidInference/FluidAudio.git "$FLUIDAUDIO_DIR"
    cd "$FLUIDAUDIO_DIR"
fi

echo ""
echo "Building FluidAudio (release mode)..."
echo "This may take a minute..."
echo ""

swift build -c release

# Verify build
CLI_PATH="$FLUIDAUDIO_DIR/.build/release/fluidaudiocli"
if [ -f "$CLI_PATH" ]; then
    echo ""
    echo "========================================"
    echo "  Setup Complete!"
    echo "========================================"
    echo ""
    echo "FluidAudio CLI: $CLI_PATH"
    echo ""
    echo "Usage:"
    echo "  npm run test:diarization:fluidaudio -- /path/to/audio.wav"
    echo ""
else
    echo ""
    echo "Error: Build failed - CLI not found at $CLI_PATH"
    exit 1
fi
