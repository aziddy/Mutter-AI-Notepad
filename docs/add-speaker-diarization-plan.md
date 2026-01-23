# Speaker Diarization Test Implementation Plan

## Overview

Add speaker diarization capability using WhisperX (Python-based) as a standalone, testable feature isolated from the main app. This allows validating diarization works well before UI integration.

## Prerequisites

1. **Hugging Face Account** - Required for pyannote diarization models
   - Create account at https://huggingface.co
   - Accept terms at https://huggingface.co/pyannote/speaker-diarization-3.1
   - Accept terms at https://huggingface.co/pyannote/segmentation-3.0
   - Create token at https://huggingface.co/settings/tokens

**Why HF Token is Required**: WhisperX uses pyannote.audio models for speaker identification. These models are hosted on Hugging Face with a license requiring authentication. Without the token, WhisperX can still transcribe audio, but cannot identify different speakers.

## Implementation Steps

### Step 1: Install Vitest

Modify `package.json` to add:
- `vitest` and `@vitest/ui` as devDependencies
- Test scripts: `test`, `test:watch`, `test:ui`, `test:diarization`

### Step 2: Create Vitest Configuration

Create `vitest.config.ts` with:
- Node environment for diarization tests
- 2-minute timeout for long-running diarization tests
- Path aliases matching existing `@/*` config

### Step 3: Create Python WhisperX Setup Script

Create `scripts/diarization/setup-whisperx.sh`:
- Creates Python virtual environment
- Installs WhisperX and dependencies (CPU version for testing)
- Prints setup instructions for HF token

### Step 4: Create Python WhisperX Runner

Create `scripts/diarization/run_whisperx.py`:
- Command-line tool that processes audio files
- Runs WhisperX transcription + alignment
- Runs pyannote diarization (if HF token provided)
- Outputs structured JSON with speaker assignments
- Handles errors gracefully with JSON error responses

Output format:
```json
{
  "success": true,
  "text": "full transcription",
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "Hello", "speaker": "SPEAKER_00"}
  ],
  "speakers": ["SPEAKER_00", "SPEAKER_01"],
  "language": "en"
}
```

### Step 5: Create Node.js Diarization Service

Create `scripts/diarization/diarization-service.js`:
- `DiarizationService` class (similar pattern to `TranscriptionService`)
- `checkEnvironment()` - validates setup
- `diarize(audioPath)` - spawns Python subprocess, returns parsed JSON
- Follows existing `child_process.spawn()` pattern from `transcription.js`

### Step 6: Create Manual Test Runner

Create `scripts/test-diarization.js`:
- Standalone test script (similar to `scripts/test-local-llm.js`)
- Checks environment setup
- Finds existing audio files from `transcriptions/` folder
- Runs diarization and validates results
- Outputs full result to `diarization-test-output.json`

### Step 7: Create Vitest Test Suite

Create `tests/diarization/whisperx.test.ts`:
- Environment check tests
- Diarization processing tests (with skipIf for missing audio)
- Error handling tests
- 5-minute timeout for long-running tests

Create `tests/setup.ts`:
- Test utilities and fixtures directory setup

### Step 8: Update .gitignore

Add:
```
scripts/diarization/venv/
diarization-test-output.json
tests/diarization/fixtures/*.wav
.env
.env.local
```

### Step 9: Create .env.example

Document required environment variables for future users.

## Files to Create

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Vitest configuration |
| `scripts/diarization/setup-whisperx.sh` | Python environment setup |
| `scripts/diarization/run_whisperx.py` | WhisperX runner (Python) |
| `scripts/diarization/diarization-service.js` | Node.js integration |
| `scripts/test-diarization.js` | Manual test runner |
| `tests/setup.ts` | Test utilities |
| `tests/diarization/whisperx.test.ts` | Vitest tests |
| `tests/diarization/fixtures/.gitkeep` | Fixture placeholder |
| `.env.example` | Environment template |

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add vitest deps, test scripts |
| `.gitignore` | Add diarization ignores |

## Usage After Implementation

```bash
# 1. Install dependencies
npm install

# 2. Set up Python environment
cd scripts/diarization && bash setup-whisperx.sh

# 3. Create .env file with your HF token
cp .env.example .env
# Edit .env and set HF_TOKEN=your_actual_token

# 4. Run manual test
npm run test:diarization

# 5. Run Vitest suite
npm test
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  test-diarization.js / whisperx.test.ts                 │
│                    ↓                                     │
│  diarization-service.js (Node.js - spawns subprocess)   │
│                    ↓                                     │
│  run_whisperx.py (Python - WhisperX + pyannote)         │
│                    ↓                                     │
│  JSON output with speaker assignments                    │
└─────────────────────────────────────────────────────────┘
```

## How WhisperX Speaker Diarization Works

WhisperX combines two AI models to provide transcription with speaker labels:

### 1. Whisper (Transcription)
- OpenAI's Whisper model converts speech to text
- Provides word-level timestamps through forced alignment
- Supports multiple languages with automatic detection

### 2. Pyannote.audio (Speaker Diarization)
- Identifies "who spoke when" by analyzing voice characteristics
- Creates speaker embeddings (voice fingerprints) for each detected speaker
- Labels speakers as `SPEAKER_00`, `SPEAKER_01`, etc.

### Processing Pipeline

```
Audio File
    ↓
┌─────────────────────────────────────┐
│  1. Voice Activity Detection (VAD)  │  ← Finds speech segments
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  2. Whisper Transcription           │  ← Speech → Text
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  3. Forced Alignment                │  ← Word-level timestamps
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  4. Speaker Diarization (pyannote)  │  ← Who spoke when
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  5. Assign Speakers to Words        │  ← Merge results
└─────────────────────────────────────┘
    ↓
JSON Output with speaker labels
```

### Audio Length Requirements

For accurate multi-speaker detection:
- **Minimum**: 30-60 seconds total audio
- **Recommended**: 1-2+ minutes
- Each speaker needs ~10-15 seconds of speech
- Multiple turn-takings help distinguish speakers

Short clips (< 30s) may only detect one speaker even if multiple are present.

## How Node.js Calls Python

The integration uses Node.js `child_process.spawn()` to run Python as a subprocess:

### Node.js Side (`diarization-service.js`)

```javascript
const { spawn } = require('child_process');

class DiarizationService {
  async diarize(audioPath) {
    return new Promise((resolve, reject) => {
      // Use Python from virtual environment
      const python = 'scripts/diarization/venv/bin/python';

      // Build command arguments
      const args = [
        'scripts/diarization/run_whisperx.py',
        audioPath,
        '--model', 'large-v2',
        '--device', 'cpu',
        '--hf-token', process.env.HF_TOKEN
      ];

      // Spawn Python subprocess
      const proc = spawn(python, args);

      let stdout = '';
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.on('close', (code) => {
        // Parse JSON output from Python
        const result = JSON.parse(stdout);
        resolve(result);
      });
    });
  }
}
```

### Python Side (`run_whisperx.py`)

```python
import whisperx
import json
import sys

def run_diarization(audio_path, hf_token):
    # Load and transcribe
    model = whisperx.load_model("large-v2", "cpu")
    audio = whisperx.load_audio(audio_path)
    result = model.transcribe(audio)

    # Align for word timestamps
    model_a, metadata = whisperx.load_align_model(language_code="en")
    result = whisperx.align(result["segments"], model_a, metadata, audio)

    # Run speaker diarization
    from whisperx.diarize import DiarizationPipeline
    diarize_model = DiarizationPipeline(use_auth_token=hf_token)
    diarize_segments = diarize_model(audio)

    # Assign speakers to words
    result = whisperx.assign_word_speakers(diarize_segments, result)

    # Output JSON to stdout (Node.js reads this)
    print(json.dumps(result))

if __name__ == "__main__":
    run_diarization(sys.argv[1], sys.argv[2])
```

### Communication Flow

```
┌──────────────────┐     spawn()      ┌──────────────────┐
│                  │ ──────────────→  │                  │
│  Node.js         │                  │  Python          │
│  (diarization-   │                  │  (run_whisperx   │
│   service.js)    │                  │   .py)           │
│                  │  ←────────────   │                  │
│                  │   stdout (JSON)  │                  │
└──────────────────┘                  └──────────────────┘
```

Key points:
- **Isolation**: Python runs in its own process with dedicated venv
- **Communication**: JSON over stdout (Python prints, Node reads)
- **Error handling**: Both success and error responses are JSON
- **Environment**: HF_TOKEN passed via command line argument

## Notes

- WhisperX runs in Python subprocess, completely isolated from main Electron app
- Can use existing audio files from `transcriptions/` folder for testing
- Without HF token, transcription works but speaker labels will be missing
- CPU mode used by default for testing (GPU optional for faster processing)
- PyTorch 2.6+ requires a compatibility patch for pyannote model loading
