# Mutter AI Notepad

A  desktop transcription app that processes audio and video files locally using OpenAI's Whisper model, with optional AI-enhanced features for summaries and insights.


## Features


## Prerequisites

- Node.js (version 16 or later)
- npm or yarn package manager
- FFmpeg (automatically included via ffmpeg-static)

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

### AI Features (Optional)

To use AI-enhanced features:

1. Obtain an OpenAI API key from [OpenAI](https://platform.openai.com)
2. Enter your API key in the "AI Features" section
3. Click "Save" to store the key locally
4. Use the available AI features:
   - **Generate Summary**: Create a concise summary of the transcription
   - **Generate Insights**: Analyze themes, sentiment, and key patterns
   - **Ask Questions**: Query specific details about the transcription content

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

### API Key Storage

API keys are stored locally in your browser's localStorage and never transmitted except to OpenAI's API when you use AI features.

## Project Structure

```
src/
├── main.js           # Electron main process
├── preload.js        # Secure IPC bridge
├── transcription.js  # Whisper integration
├── llm.js           # OpenAI API integration
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

**AI features not working**:
- Verify your OpenAI API key is valid
- Check your internet connection
- Ensure you have sufficient OpenAI credits

### Performance Tips

- Use smaller Whisper models for faster processing
- Close other heavy applications during transcription
- For very long files, consider splitting them into smaller segments

## Development Notes

### Architecture

- **Main Process**: Handles file operations, transcription, and AI API calls
- **Renderer Process**: Manages the UI and user interactions
- **IPC Communication**: Secure communication between processes via contextBridge

