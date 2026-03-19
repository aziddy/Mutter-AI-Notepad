/**
 * Align speaker segments from pyannote with transcription segments from Whisper.
 *
 * This utility takes two separate outputs:
 * 1. Whisper: text segments with timestamps
 * 2. Pyannote: speaker segments with timestamps
 *
 * And merges them to produce text segments with speaker assignments.
 */

/**
 * @typedef {Object} WordTimestamp
 * @property {string} text - Word text
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 */

/**
 * @typedef {Object} WhisperSegment
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} text - Transcribed text
 * @property {WordTimestamp[]} [words] - Optional word-level timestamps (from -ojf full JSON)
 */

/**
 * @typedef {Object} SpeakerSegment
 * @property {string} speaker - Speaker ID (e.g., "SPEAKER_00")
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 */

/**
 * @typedef {Object} AlignedSegment
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} text - Transcribed text
 * @property {string} speaker - Assigned speaker ID
 * @property {number} confidence - Confidence of speaker assignment (0-1)
 */

/**
 * Calculate the overlap between two time ranges.
 * @param {number} start1
 * @param {number} end1
 * @param {number} start2
 * @param {number} end2
 * @returns {number} Overlap duration in seconds
 */
function calculateOverlap(start1, end1, start2, end2) {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Find the speaker with the most overlap for a given time range.
 * @param {number} start - Start time
 * @param {number} end - End time
 * @param {SpeakerSegment[]} speakerSegments - Speaker segments from pyannote
 * @returns {{speaker: string, confidence: number}}
 */
function findBestSpeaker(start, end, speakerSegments) {
  const duration = end - start;
  if (duration <= 0) {
    return { speaker: 'UNKNOWN', confidence: 0 };
  }

  // Calculate overlap with each speaker segment
  const speakerOverlaps = {};

  for (const seg of speakerSegments) {
    const overlap = calculateOverlap(start, end, seg.start, seg.end);
    if (overlap > 0) {
      if (!speakerOverlaps[seg.speaker]) {
        speakerOverlaps[seg.speaker] = 0;
      }
      speakerOverlaps[seg.speaker] += overlap;
    }
  }

  // Find speaker with maximum overlap
  let bestSpeaker = 'UNKNOWN';
  let maxOverlap = 0;

  for (const [speaker, overlap] of Object.entries(speakerOverlaps)) {
    if (overlap > maxOverlap) {
      maxOverlap = overlap;
      bestSpeaker = speaker;
    }
  }

  // Confidence is the ratio of overlap to segment duration
  const confidence = duration > 0 ? maxOverlap / duration : 0;

  return { speaker: bestSpeaker, confidence };
}

/**
 * Merge consecutive whisper segments into longer chunks for more robust alignment.
 * Short segments (0.3-2s) are very sensitive to diarization boundary imprecision.
 * Merging into ~10s chunks makes alignment much more reliable.
 * @param {WhisperSegment[]} segments
 * @param {number} [targetDuration=10] - Target duration for merged segments in seconds
 * @param {number} [maxGap=1.0] - Maximum gap between segments to merge (seconds)
 * @returns {WhisperSegment[]}
 */
function mergeWhisperSegments(segments, targetDuration = 10, maxGap = 1.0) {
  if (!segments || segments.length === 0) return [];

  const merged = [];
  let current = { start: segments[0].start, end: segments[0].end, text: segments[0].text };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const gap = seg.start - current.end;
    const currentDuration = current.end - current.start;

    if (gap <= maxGap && currentDuration < targetDuration) {
      current.end = seg.end;
      current.text = current.text + ' ' + seg.text;
    } else {
      merged.push(current);
      current = { start: seg.start, end: seg.end, text: seg.text };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Smooth speaker assignments to reduce rapid alternation ("flicker").
 * When a segment is attributed to a different speaker than both its neighbors
 * and its confidence is low, reassign it to the surrounding speaker.
 * @param {AlignedSegment[]} segments
 * @param {number} [confidenceThreshold=0.5]
 * @returns {AlignedSegment[]}
 */
function smoothSpeakerAssignments(segments, confidenceThreshold = 0.5) {
  if (segments.length < 3) return segments;

  const smoothed = segments.map((seg) => ({ ...seg }));

  for (let i = 1; i < smoothed.length - 1; i++) {
    const prev = smoothed[i - 1];
    const curr = smoothed[i];
    const next = smoothed[i + 1];

    if (
      prev.speaker === next.speaker &&
      curr.speaker !== prev.speaker &&
      curr.confidence < confidenceThreshold
    ) {
      smoothed[i].speaker = prev.speaker;
    }
  }

  return smoothed;
}

/**
 * Find the word index where a speaker boundary falls, using word-level timestamps.
 * Returns the index of the first word that belongs to the next speaker's segment.
 * @param {WordTimestamp[]} words - Words with timestamps
 * @param {number} boundaryTime - Speaker boundary time in seconds
 * @returns {number} Index of the first word after the boundary
 */
function findWordIndexAtBoundary(words, boundaryTime) {
  // Find the first word whose start time is >= the boundary
  // This word and everything after it belong to the next speaker
  for (let i = 0; i < words.length; i++) {
    if (words[i].start !== null && words[i].start >= boundaryTime) {
      return i;
    }
  }
  return words.length;
}

/**
 * Split a whisper segment at speaker boundaries when multiple speakers overlap.
 * Uses word-level timestamps for precise splitting when available,
 * falls back to proportional time allocation otherwise.
 * @param {WhisperSegment} whisperSeg - A single whisper segment
 * @param {SpeakerSegment[]} speakerSegments - Speaker segments from diarization
 * @returns {AlignedSegment[]}
 */
function splitAtSpeakerBoundaries(whisperSeg, speakerSegments) {
  // Find all speaker segments that overlap this whisper segment
  const overlapping = speakerSegments.filter(
    (s) => calculateOverlap(whisperSeg.start, whisperSeg.end, s.start, s.end) > 0
  );

  if (overlapping.length === 0) {
    return [{
      start: whisperSeg.start,
      end: whisperSeg.end,
      text: whisperSeg.text.trim(),
      speaker: 'UNKNOWN',
      confidence: 0,
    }];
  }

  // Check if all overlapping segments have the same speaker
  const uniqueSpeakers = new Set(overlapping.map((s) => s.speaker));
  if (uniqueSpeakers.size === 1) {
    const speaker = overlapping[0].speaker;
    const overlap = overlapping.reduce(
      (sum, s) => sum + calculateOverlap(whisperSeg.start, whisperSeg.end, s.start, s.end),
      0
    );
    const duration = whisperSeg.end - whisperSeg.start;
    return [{
      start: whisperSeg.start,
      end: whisperSeg.end,
      text: whisperSeg.text.trim(),
      speaker,
      confidence: duration > 0 ? overlap / duration : 0,
    }];
  }

  // Multiple speakers overlap - split at speaker transition boundaries
  // Sort overlapping segments by start time
  const sorted = [...overlapping].sort((a, b) => a.start - b.start);

  // Build split points from speaker boundaries within this whisper segment
  const splitPoints = [whisperSeg.start];
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    if (curr.speaker !== next.speaker) {
      // Speaker transition - use the earlier natural boundary
      // When there's a gap: use curr.end (speaker A stopped talking)
      // When there's overlap: use next.start (speaker B started talking)
      const boundary = Math.min(curr.end, next.start);
      const clampedBoundary = Math.max(whisperSeg.start, Math.min(whisperSeg.end, boundary));
      if (clampedBoundary > splitPoints[splitPoints.length - 1] + 0.05) {
        splitPoints.push(clampedBoundary);
      }
    }
  }
  splitPoints.push(whisperSeg.end);

  if (splitPoints.length <= 2) {
    // No meaningful split points found, assign best speaker
    const { speaker, confidence } = findBestSpeaker(whisperSeg.start, whisperSeg.end, speakerSegments);
    return [{
      start: whisperSeg.start,
      end: whisperSeg.end,
      text: whisperSeg.text.trim(),
      speaker,
      confidence,
    }];
  }

  // Check if we have word-level timestamps for precise splitting
  const hasWordTimestamps = whisperSeg.words && whisperSeg.words.length > 0;

  if (hasWordTimestamps) {
    // PRECISE PATH: Use word-level timestamps to split at exact word boundaries
    const wordTimestamps = whisperSeg.words;
    const result = [];
    let wordIdx = 0;

    for (let i = 0; i < splitPoints.length - 1; i++) {
      const subStart = splitPoints[i];
      const subEnd = splitPoints[i + 1];
      const isLast = i === splitPoints.length - 2;

      // Find which words fall in this sub-segment
      let endIdx;
      if (isLast) {
        endIdx = wordTimestamps.length;
      } else {
        endIdx = findWordIndexAtBoundary(wordTimestamps, subEnd);
        // Ensure at least one word per sub-segment (unless it's truly empty)
        if (endIdx <= wordIdx && wordIdx < wordTimestamps.length) {
          endIdx = wordIdx + 1;
        }
      }

      if (endIdx <= wordIdx) continue;

      const subWords = wordTimestamps.slice(wordIdx, endIdx);
      const subText = subWords.map((w) => w.text).join(' ');
      wordIdx = endIdx;

      const { speaker, confidence } = findBestSpeaker(subStart, subEnd, speakerSegments);
      result.push({ start: subStart, end: subEnd, text: subText, speaker, confidence });
    }

    return result.length > 0 ? result : [{
      start: whisperSeg.start,
      end: whisperSeg.end,
      text: whisperSeg.text.trim(),
      speaker: 'UNKNOWN',
      confidence: 0,
    }];
  }

  // FALLBACK PATH: Split text proportionally by duration (no word timestamps)
  const totalDuration = whisperSeg.end - whisperSeg.start;
  const words = whisperSeg.text.trim().split(/\s+/).filter((w) => w.length > 0);
  const result = [];
  let wordIndex = 0;

  for (let i = 0; i < splitPoints.length - 1; i++) {
    const subStart = splitPoints[i];
    const subEnd = splitPoints[i + 1];
    const subDuration = subEnd - subStart;
    const fraction = totalDuration > 0 ? subDuration / totalDuration : 0;

    // Calculate word count for this sub-segment
    const isLast = i === splitPoints.length - 2;
    let wordCount;
    if (isLast) {
      wordCount = words.length - wordIndex;
    } else {
      wordCount = Math.floor(fraction * words.length);
      wordCount = Math.max(1, Math.min(wordCount, words.length - wordIndex - 1));
    }

    if (wordCount <= 0) continue;

    const subText = words.slice(wordIndex, wordIndex + wordCount).join(' ');
    wordIndex += wordCount;

    const { speaker, confidence } = findBestSpeaker(subStart, subEnd, speakerSegments);
    result.push({ start: subStart, end: subEnd, text: subText, speaker, confidence });
  }

  return result.length > 0 ? result : [{
    start: whisperSeg.start,
    end: whisperSeg.end,
    text: whisperSeg.text.trim(),
    speaker: 'UNKNOWN',
    confidence: 0,
  }];
}

/**
 * Merge consecutive aligned segments that share the same speaker and are close together.
 * This reduces over-fragmentation without losing speaker boundaries.
 * @param {AlignedSegment[]} segments
 * @param {number} [maxGap=0.3] - Maximum gap to merge across (seconds)
 * @returns {AlignedSegment[]}
 */
function mergeSameSpeakerSegments(segments, maxGap = 0.3) {
  if (!segments || segments.length === 0) return [];

  const merged = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const gap = seg.start - current.end;

    if (seg.speaker === current.speaker && gap <= maxGap) {
      current.end = seg.end;
      current.text = current.text + ' ' + seg.text;
      current.confidence = Math.min(current.confidence, seg.confidence);
    } else {
      merged.push(current);
      current = { ...seg };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Align whisper transcription segments with speaker diarization segments.
 * Uses speaker-boundary-driven alignment: splits whisper segments at speaker
 * transition points for fine-grained speaker attribution.
 * @param {WhisperSegment[]} whisperSegments - Transcription segments from Whisper
 * @param {SpeakerSegment[]} speakerSegments - Speaker segments from diarization backend
 * @returns {AlignedSegment[]}
 */
function alignSpeakers(whisperSegments, speakerSegments) {
  if (!whisperSegments || whisperSegments.length === 0) {
    return [];
  }

  if (!speakerSegments || speakerSegments.length === 0) {
    // No speaker info - return segments with UNKNOWN speaker
    return whisperSegments.map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
      speaker: 'UNKNOWN',
      confidence: 0,
    }));
  }

  // Split each whisper segment at speaker boundaries
  // Returns fine-grained segments (no merging) so SRT view has individual entries
  // formatSpeakerTranscript() handles grouping for speakers.txt readability
  const aligned = [];
  for (const seg of whisperSegments) {
    const splitSegments = splitAtSpeakerBoundaries(seg, speakerSegments);
    aligned.push(...splitSegments);
  }

  return aligned;
}

/**
 * Parse SRT content to extract segments with timestamps.
 * @param {string} srtContent - SRT file content
 * @returns {WhisperSegment[]}
 */
function parseSRT(srtContent) {
  if (!srtContent || typeof srtContent !== 'string') {
    return [];
  }

  const segments = [];
  const blocks = srtContent.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // Line 1: index (ignore)
    // Line 2: timestamps
    // Line 3+: text
    const timestampLine = lines[1];
    const text = lines.slice(2).join(' ').trim();

    const timestampMatch = timestampLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );

    if (timestampMatch) {
      const start =
        parseInt(timestampMatch[1]) * 3600 +
        parseInt(timestampMatch[2]) * 60 +
        parseInt(timestampMatch[3]) +
        parseInt(timestampMatch[4]) / 1000;

      const end =
        parseInt(timestampMatch[5]) * 3600 +
        parseInt(timestampMatch[6]) * 60 +
        parseInt(timestampMatch[7]) +
        parseInt(timestampMatch[8]) / 1000;

      segments.push({ start, end, text });
    }
  }

  return segments;
}

/**
 * Extract word-level timestamps from whisper.cpp full JSON tokens.
 * Tokens starting with a space begin a new word; subsequent tokens without
 * a leading space are subword continuations of the same word.
 * @param {Array} tokens - Token array from whisper.cpp -ojf output
 * @returns {WordTimestamp[]}
 */
function extractWordsFromTokens(tokens) {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return [];
  }

  const words = [];
  let currentWord = null;

  for (const token of tokens) {
    // Skip special tokens (id >= 50257 in whisper) and empty text
    if (!token.text || token.text === '' || (token.id && token.id >= 50257)) {
      continue;
    }

    const hasLeadingSpace = token.text.startsWith(' ');
    const tokenText = token.text.trimStart();

    if (tokenText.length === 0) continue;

    const tokenStart = token.offsets ? token.offsets.from / 1000 : null;
    const tokenEnd = token.offsets ? token.offsets.to / 1000 : null;

    if (hasLeadingSpace || currentWord === null) {
      // Start a new word
      if (currentWord && currentWord.text.trim()) {
        words.push(currentWord);
      }
      currentWord = {
        text: tokenText,
        start: tokenStart,
        end: tokenEnd,
      };
    } else {
      // Subword continuation - append to current word
      if (currentWord) {
        currentWord.text += tokenText;
        if (tokenEnd !== null) {
          currentWord.end = tokenEnd;
        }
      }
    }
  }

  // Push the last word
  if (currentWord && currentWord.text.trim()) {
    words.push(currentWord);
  }

  return words;
}

/**
 * Parse whisper.cpp JSON output to extract segments.
 * Supports both standard (-oj) and full (-ojf) JSON formats.
 * When full JSON is provided, word-level timestamps are extracted from tokens.
 * @param {Object} whisperJson - Whisper JSON output
 * @returns {WhisperSegment[]}
 */
function parseWhisperJson(whisperJson) {
  if (!whisperJson || !whisperJson.transcription) {
    return [];
  }

  return whisperJson.transcription.map((item) => {
    const start = parseTimestamp(item.timestamps.from.replace(',', '.'));
    const end = parseTimestamp(item.timestamps.to.replace(',', '.'));
    const text = item.text.trim();

    // Extract word-level timestamps from full JSON tokens (if available)
    const words = extractWordsFromTokens(item.tokens);

    const segment = { start, end, text };
    if (words.length > 0) {
      segment.words = words;
    }
    return segment;
  });
}

/**
 * Parse timestamp string to seconds.
 * @param {string} ts - Timestamp like "00:00:01.234" or "00:00:01,234"
 * @returns {number}
 */
function parseTimestamp(ts) {
  if (typeof ts === 'number') return ts;
  const normalized = ts.replace(',', '.');
  const match = normalized.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
  if (match) {
    return (
      parseInt(match[1]) * 3600 +
      parseInt(match[2]) * 60 +
      parseInt(match[3]) +
      parseInt(match[4]) / 1000
    );
  }
  return 0;
}

module.exports = {
  alignSpeakers,
  splitAtSpeakerBoundaries,
  mergeSameSpeakerSegments,
  mergeWhisperSegments,
  smoothSpeakerAssignments,
  parseSRT,
  parseWhisperJson,
  findBestSpeaker,
  calculateOverlap,
};
