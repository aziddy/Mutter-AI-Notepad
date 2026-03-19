# Better Auto Speaker Segmentation

## Problem

Speaker segments were blurring into each other during diarization. When a single Whisper segment spanned a speaker transition, the alignment algorithm split text **proportionally by time duration** — assigning 60% of words to speaker A if they talked for 60% of the time. This was inaccurate because speaking rate varies, pauses aren't uniform, and the system had no way to know which word actually fell at the speaker boundary.

### Example

**Before (incorrect):**
```
[T] that answer your question M yeah so uh there's uh different fields in erp that we can use
[M] uh that idle as an example to identify a next segment um
```

**After (correct):**
```
[T] that answer your question M
[M] yeah so uh there's uh different fields in erp that we can use
[M] uh that idle as an example to identify a next segment um
```

## Root Cause

`splitAtSpeakerBoundaries()` in `src/utils/align-speakers.js` used `Math.floor(fraction * words.length)` to distribute words across speaker boundaries. Without word-level timestamps, the code guessed word positions based on time proportion — often off by 1-3 words at every speaker transition.

## Solution: Word-Level Timestamps from whisper.cpp

whisper.cpp supports `-ojf` (output-json-full) which includes per-token timestamps in the JSON output. Each token has `offsets.from` and `offsets.to` in milliseconds. By extracting these, we can find the exact word at each speaker boundary instead of guessing.

## Changes

### 1. `src/transcription.js` — Whisper flags

- Changed `-oj` to `-ojf` — outputs full JSON with per-token timestamps
- Added `-sow` (split-on-word) — ensures Whisper's own segment boundaries align with word boundaries

### 2. `src/utils/align-speakers.js` — Word-level alignment

**New function: `extractWordsFromTokens(tokens)`**
- Parses the full JSON `tokens` array from each Whisper segment
- Groups subword tokens into full words (tokens starting with a space begin a new word)
- Returns `[{text, start, end}]` per word with timestamps in seconds

**Updated: `parseWhisperJson(whisperJson)`**
- Now extracts word-level timestamps via `extractWordsFromTokens()` and attaches a `words` array to each `WhisperSegment`
- Backward compatible — works with both standard (`-oj`) and full (`-ojf`) JSON

**New function: `findWordIndexAtBoundary(words, boundaryTime)`**
- Binary-style lookup: finds the first word whose `start >= boundaryTime`
- Returns the index where the next speaker's text begins

**Updated: `splitAtSpeakerBoundaries(whisperSeg, speakerSegments)`**
- New **precise path** (when `whisperSeg.words` exists): uses `findWordIndexAtBoundary()` to split at the exact word where the speaker changes
- **Fallback path** (no word timestamps): preserves the original proportional allocation for backward compatibility

### 3. `scripts/diarization/diarization-service.js` — Pipeline update

- Now prefers `parseWhisperJson()` over `parseSRT()` when full JSON is available
- This ensures word-level timestamps flow through to the alignment step (SRT format doesn't carry word timestamps)

## Data Flow

```
Audio File
    |
    v
whisper.cpp (-ojf -sow)
    |
    v
Full JSON with per-token timestamps
    |  parseWhisperJson() extracts words[] per segment
    v
WhisperSegment[] with words: [{text, start, end}, ...]
    |
    v
splitAtSpeakerBoundaries()
    |  findWordIndexAtBoundary() finds exact word at speaker transition
    v
AlignedSegment[] with precise speaker-to-text mapping
```
