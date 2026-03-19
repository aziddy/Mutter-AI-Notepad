# Best Recording Audio Settings

Recommended audio settings for meeting recordings used with Mutter AI Notepad, optimized for both Whisper transcription accuracy and in-app audio playback quality.

## Recommended Settings

| Setting     | Recommended | Notes                                      |
|-------------|-------------|---------------------------------------------|
| Codec       | AAC         | Widely supported; Opus is also excellent    |
| Channels    | Mono        | Whisper expects mono; stereo adds no benefit |
| Sample Rate | 48 kHz      | Standard; provides headroom for downsampling |
| Bitrate     | 128 kbps    | Sweet spot for speech clarity vs file size   |

## Why These Settings Matter

### Whisper Transcription

The app converts all audio to **16 kHz mono PCM WAV** before feeding it to Whisper (via FFmpeg). Even though Whisper always receives 16 kHz audio, the **source quality directly affects transcription accuracy**. A higher-bitrate source means cleaner audio survives the downsampling process, resulting in fewer errors — especially on:

- Quiet or distant speakers
- Overlapping speech / crosstalk
- Consonant-heavy words and proper nouns

### In-App Audio Playback

The audio player streams the **original file** without conversion. Higher source bitrate means noticeably clearer playback, particularly during segments with multiple speakers or background noise.

## Bitrate Comparison

| Bitrate   | Quality for Speech            | ~File Size (44 min) |
|-----------|-------------------------------|---------------------|
| 64 kbps   | Functional but artifacts on crosstalk and quiet speakers | ~21 MB audio |
| **128 kbps** | **Clear speech, minimal artifacts** | **~42 MB audio** |
| 192 kbps  | Diminishing returns for speech | ~63 MB audio |

128 kbps AAC mono is the recommended sweet spot — meaningful quality improvement over 64 kbps with negligible file size increase.

## Example: Typical Meeting Recording

```
CURRENT (suboptimal):
  Codec: aac | Channels: mono | Sample Rate: 48000 Hz | Bitrate: 64k

RECOMMENDED:
  Codec: aac | Channels: mono | Sample Rate: 48000 Hz | Bitrate: 128k
```

## How the Transcription Pipeline Processes Audio

1. User selects a video/audio file
2. FFmpeg extracts and converts audio to: **16 kHz, mono, PCM 16-bit WAV**
3. Whisper processes the WAV with `ggml-large-v3-turbo` model
4. Outputs: `.txt`, `.json`, and `.srt` files

The conversion parameters are defined in `src/transcription.js` (`convertToWav` method). Since Whisper always receives the same format, the source recording quality is the primary variable you can control.
