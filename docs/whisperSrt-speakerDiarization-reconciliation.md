# Whisper SRT + Speaker Diarization Reconciliation

## Overview

Whisper generates SRT subtitle segments with timestamps but no speaker information. WhisperX diarization provides speaker labels at the word level. This utility reconciles them by assigning the dominant speaker to each SRT segment based on timestamp overlap.

## Data Flow

```
Whisper Transcription          WhisperX Diarization
        │                              │
        ▼                              ▼
   SRT Segments                 Word-level speakers
  (start, end, text)         (start, end, word, speaker)
        │                              │
        └──────────┬───────────────────┘
                   ▼
           Reconciliation Algorithm
                   │
                   ▼
         SRT + Speaker Labels
      (start, end, text, speaker, confidence)
```

## Algorithm

For each SRT entry:

1. **Find overlapping words** from diarization where:
   ```
   word.start < srtEntry.endTime AND word.end > srtEntry.startTime
   ```

2. **Calculate overlap duration** for each word:
   ```
   overlap = min(word.end, srtEntry.endTime) - max(word.start, srtEntry.startTime)
   ```

3. **Accumulate speaker time** - sum overlap durations per speaker

4. **Select dominant speaker** - speaker with highest total overlap duration

5. **Calculate confidence**:
   ```
   confidence = dominantSpeakerDuration / totalOverlapDuration
   ```

## Example

```
SRT Entry: [5.0s - 10.0s] "Hello, how are you today?"

Diarization words in range:
  - "Hello"   [5.0 - 5.5]  SPEAKER_00  → overlap: 0.5s
  - "how"     [5.6 - 5.9]  SPEAKER_00  → overlap: 0.3s
  - "are"     [6.0 - 6.3]  SPEAKER_01  → overlap: 0.3s
  - "you"     [6.4 - 6.7]  SPEAKER_00  → overlap: 0.3s
  - "today"   [6.8 - 7.2]  SPEAKER_00  → overlap: 0.4s

Speaker totals:
  - SPEAKER_00: 0.5 + 0.3 + 0.3 + 0.4 = 1.5s
  - SPEAKER_01: 0.3s

Result: SPEAKER_00 with confidence 1.5/1.8 = 83%
```

## Output Format

```js
{
  startTime: 5.0,
  endTime: 10.0,
  text: "Hello, how are you today?",
  speaker: "SPEAKER_00",
  confidence: 0.83
}
```

## Usage

```js
const { reconcileSpeakersFromSRT } = require('../src/utils/reconcile-speakers');

// srtContent: raw SRT file string
// diarizationResult: output from DiarizationService.diarize()
const entries = reconcileSpeakersFromSRT(srtContent, diarizationResult);

entries.forEach(entry => {
  console.log(`${entry.speaker}: "${entry.text}"`);
});
```

## Edge Cases

| Case | Behavior |
|------|----------|
| No overlapping words | `speaker: null`, `confidence: 0` |
| Equal speaker split | First speaker in iteration wins |
| Diarization failed | All entries get `speaker: null` |
| Empty SRT | Returns empty array |

## Files

- `src/utils/reconcile-speakers.js` - Core reconciliation functions
- `scripts/test-diarization.js` - Test script with reconciliation demo
