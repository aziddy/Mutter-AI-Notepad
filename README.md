# Mutter AI Notepad

A desktop transcription app that processes audio and video files locally using OpenAI's Whisper model, with AI-enhanced features powered by either local Qwen3 models or OpenAI-compatible APIs.

## Features

- **Local Audio/Video Transcription**: Process files locally using OpenAI Whisper
- **Dual LLM Support**: Choose between local Qwen3 models or OpenAI-compatible APIs
- **AI-Powered Analysis**: Generate summaries, insights, and answer questions
- **SRT Subtitle Support**: View transcriptions with timestamps and audio sync
- **Local Storage**: All transcriptions and settings stored locally
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Prerequisites

- Node.js (version 16 or later)
- npm or yarn package manager
- FFmpeg (automatically included via ffmpeg-static)

## LLM Configuration

### Local Qwen3 Models

The app supports local Qwen3 models for completely offline AI analysis:

- **Qwen3 1.7B (Q4_0)**: Fast, good balance of speed and quality
- **Qwen3 1.7B (Q8_0)**: Higher quality, moderate speed
- **Qwen3 0.6B (Q8_0)**: Lightweight, fastest option

To use local models:
1. Download the desired Qwen3 model files to the `models/` directory
2. Open Settings (gear icon) and select "Local Qwen3 Model"
3. Choose your preferred model variant
4. Click "Load LLM Model" to initialize

### OpenAI-Compatible APIs

Connect to any OpenAI-compatible API endpoint:

- **OpenAI API**: Use official OpenAI models (GPT-3.5, GPT-4, etc.)
- **Local APIs**: Connect to local servers running Ollama, LM Studio, or similar
- **Custom Endpoints**: Any API that follows OpenAI's chat completions format

To use API models:
1. Open Settings (gear icon) and select "OpenAI-like API"
2. Enter your API endpoint (e.g., `https://api.openai.com/v1` or `http://localhost:1234/v1`)
3. Enter your API key
4. Click "Refresh Models" to load available models
5. Select your preferred model
6. Test the connection and save settings

## Run Whisper Executable Directly

``` bash
cd node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin
```

Outputs available Flags/Arguments:
```bash
./whisper-cli
```

Usage:
```bash
whisper <input_file> --model tiny --language en --output_format json
```

## Unified RAM Usage

- Whisper-Large-V3-Turbo: 2GB
- Qwen3-1.7b-8Bit: 4.6GB

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/Mutter-AI-Notepad.git
   cd Mutter-AI-Notepad
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application**:
   ```bash
   npm start
   ```

## Development

To run in development mode with developer tools:

```bash
npm run dev
```

## Building for Distribution

To build the application for distribution:

```bash
npm run build
```

## Usage

### Basic Transcription

1. Launch the application
2. Click "Select Audio/Video File" 
3. Choose your audio or video file
4. Click "Start Transcription"
5. Wait for the local processing to complete
6. View and copy your transcription

### AI Features

#### Using Local Models

1. Open Settings (gear icon) and configure local model
2. Click "Load LLM Model" to initialize
3. Load a transcription into context using "Load Transcription into Context"
4. Use AI features:
   - **Generate Summary**: Create a concise summary
   - **Generate Insights**: Analyze themes and patterns
   - **Ask Questions**: Query specific details

#### Using API Models

1. Open Settings and configure your API endpoint
2. Test the connection and select a model
3. Load a transcription into context
4. Use AI features as with local models

## Supported File Formats

**Audio Files**: MP3, WAV, M4A, FLAC, OGG
**Video Files**: MP4, MOV, AVI, MKV

## Configuration

### Whisper Model Selection

You can modify the Whisper model used for transcription in `src/transcription.js`:

```javascript
modelName: "base.en"  // Options: tiny, base, small, medium, large
```

**Model Comparison**:
- `tiny`: Fastest, least accurate
- `base`: Good balance of speed and accuracy (default)
- `small`: Better accuracy, slower
- `medium`: High accuracy, significantly slower
- `large`: Highest accuracy, slowest

### LLM Configuration Storage

LLM settings are stored locally in `llm-config.json` and include:
- Model type (local vs API)
- Selected model variant
- API endpoint and key (if using API mode)

## Project Structure

```
src/
├── main.js           # Electron main process
├── preload.js        # Secure IPC bridge
├── transcription.js  # Whisper integration
├── llm.js           # LLM service (local + API)
├── index.html       # Main UI
├── styles.css       # Application styling
└── renderer.js      # Frontend logic
```

## Troubleshooting

### Common Issues

**"Module not found" errors**: 
```bash
rm -rf node_modules package-lock.json
npm install
```

**Transcription fails**:
- Ensure your audio/video file is not corrupted
- Try with a different file format
- Check the console for detailed error messages

**Local LLM not working**:
- Verify model files are in the correct `models/` directory
- Check that model files are not corrupted
- Ensure sufficient RAM is available

**API connection fails**:
- Verify API endpoint URL is correct
- Check API key is valid
- Test connection in Settings
- Ensure API server is running and accessible

### Performance Tips

- Use smaller Whisper models for faster processing
- Choose appropriate Qwen3 model size for your hardware
- Close other heavy applications during processing
- For very long files, consider splitting them into smaller segments

## Development Notes

### Architecture

- **Main Process**: Handles file operations, transcription, and LLM operations
- **Renderer Process**: Manages the UI and user interactions
- **IPC Communication**: Secure communication between processes via contextBridge
- **LLM Service**: Unified interface for both local and API models

