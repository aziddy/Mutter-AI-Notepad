# FluidAudio Speaker Diarization

FluidAudio is a macOS-only Swift/CoreML-based speaker diarization backend that identifies "who spoke when" in audio files. It leverages Apple's Neural Engine for fast on-device inference.
https://github.com/FluidInference/FluidAudio

## Speed vs Accuracy Tradeoff

| Backend | Speed | Accuracy (DER) | Platform |
|---------|-------|----------------|----------|
| FluidAudio | ~50x faster | 15-17% | macOS only (CoreML/ANE) |
| pyannote | Slower (CPU) | 7-12% | Cross-platform |

**DER** = Diarization Error Rate (lower is better)

Choose FluidAudio when speed matters more than perfect accuracy. Choose pyannote when accuracy is critical.

## Architecture

```
Audio File
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Node.js: run_fluidaudio.js                             │
│      Spawns CLI subprocess with audio path              │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Swift CLI: fluidaudiocli                               │
│      Uses CoreML / Apple Neural Engine                  │
│      Outputs JSON with speaker segments                 │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Node.js: Convert to pyannote-compatible format         │
│      Maps speaker IDs to SPEAKER_00, SPEAKER_01, etc.   │
└─────────────────────────────────────────────────────────┘
```

## Key Components

| File | Purpose |
|------|---------|
| `scripts/diarization/run_fluidaudio.js` | Node.js wrapper that spawns CLI and parses output |
| `scripts/diarization/diarization-service.js` | Unified service supporting both FluidAudio and pyannote backends |
| `scripts/diarization/FluidAudio/.build/release/fluidaudiocli` | Compiled Swift CLI binary |
| `scripts/diarization/setup-fluidaudio.sh` | Setup script to build the Swift CLI |

## How It Works

### Hybrid Diarization Pipeline

The `DiarizationService` combines transcription and speaker identification:

1. **whisper.cpp** (Metal GPU) - Transcribes speech to text with word-level timestamps
2. **FluidAudio** (CoreML/ANE) - Identifies speaker segments (who spoke when)
3. **alignSpeakers()** - Merges transcription text with speaker labels

### Usage

```javascript
const { DiarizationService } = require('./scripts/diarization/diarization-service');

// Use FluidAudio backend
const service = new DiarizationService({ backend: 'fluidaudio' });

// Check if environment is ready
const env = await service.checkEnvironment();
if (!env.ready) {
  console.error(env.message);
}

// Run diarization
const result = await service.diarize('/path/to/audio.wav', {
  onProgress: (msg) => console.log(msg)
});
```

### Direct FluidAudio Usage

```javascript
const { runFluidAudio, checkFluidAudioAvailable } = require('./scripts/diarization/run_fluidaudio');

// Check availability
const check = checkFluidAudioAvailable();
if (!check.available) {
  console.error(check.message);
}

// Run diarization only (no transcription)
const result = await runFluidAudio('/path/to/audio.wav', {
  onProgress: (msg) => console.log(msg)
});
```

## Output Format

FluidAudio outputs are converted to a pyannote-compatible format:

```json
{
  "success": true,
  "segments": [
    { "speaker": "SPEAKER_00", "start": 0.0, "end": 5.2 },
    { "speaker": "SPEAKER_01", "start": 5.2, "end": 10.8 },
    { "speaker": "SPEAKER_00", "start": 10.8, "end": 15.0 }
  ],
  "speakers": ["SPEAKER_00", "SPEAKER_01"],
  "metadata": {
    "audio_file": "/path/to/audio.wav",
    "backend": "fluidaudio",
    "device": "CoreML/ANE",
    "num_segments": 3,
    "num_speakers": 2,
    "processing_time_seconds": 1.23,
    "real_time_factor": 0.05,
    "duration_seconds": 25.0
  }
}
```

## Setup

### Prerequisites

- macOS (FluidAudio uses CoreML which is macOS-only)
- Xcode Command Line Tools
- Swift toolchain

### Build the CLI

```bash
cd scripts/diarization
bash setup-fluidaudio.sh
```

Or manually:

```bash
cd scripts/diarization/FluidAudio
swift build -c release
```

The compiled binary will be at:
```
scripts/diarization/FluidAudio/.build/release/fluidaudiocli
```

### Verify Installation

```bash
node scripts/diarization/run_fluidaudio.js /path/to/audio.wav
```

## CLI Usage

The FluidAudio CLI can be run directly:

```bash
# Process audio file
./fluidaudiocli process audio.wav --mode offline --output result.json

# Arguments:
#   process <audio_file>  - Audio file to process
#   --mode offline        - Processing mode (offline for best accuracy)
#   --output <path>       - Output JSON file path
```

## Comparison with pyannote

| Feature | FluidAudio | pyannote |
|---------|------------|----------|
| Speed | ~50x faster | Baseline |
| Accuracy | 15-17% DER | 7-12% DER |
| Platform | macOS only | Cross-platform |
| Hardware | CoreML/ANE | CPU (GPU optional) |
| Setup | Swift build | Python venv + HF token |
| Dependencies | None (native) | PyTorch, torchaudio, etc. |

## Troubleshooting

### CLI not found

```
FluidAudio CLI not found at scripts/diarization/FluidAudio/.build/release/fluidaudiocli
```

**Solution**: Build the CLI with `cd scripts/diarization/FluidAudio && swift build -c release`

### Not available on Linux/Windows

FluidAudio uses Apple's CoreML framework and is only available on macOS. Use the pyannote backend on other platforms:

```javascript
const service = new DiarizationService({ backend: 'pyannote' });
```
