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
 * @typedef {Object} WhisperSegment
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} text - Transcribed text
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
 * Align whisper transcription segments with pyannote speaker segments.
 * @param {WhisperSegment[]} whisperSegments - Transcription segments from Whisper
 * @param {SpeakerSegment[]} speakerSegments - Speaker segments from pyannote
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

  return whisperSegments.map((seg) => {
    const { speaker, confidence } = findBestSpeaker(
      seg.start,
      seg.end,
      speakerSegments
    );

    return {
      start: seg.start,
      end: seg.end,
      text: seg.text,
      speaker,
      confidence,
    };
  });
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
 * Parse whisper.cpp JSON output to extract segments.
 * @param {Object} whisperJson - Whisper JSON output
 * @returns {WhisperSegment[]}
 */
function parseWhisperJson(whisperJson) {
  if (!whisperJson || !whisperJson.transcription) {
    return [];
  }

  return whisperJson.transcription.map((item) => ({
    start: item.timestamps.from.replace(',', '.'),
    end: item.timestamps.to.replace(',', '.'),
    text: item.text.trim(),
  })).map((seg) => ({
    start: parseTimestamp(seg.start),
    end: parseTimestamp(seg.end),
    text: seg.text,
  }));
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
  parseSRT,
  parseWhisperJson,
  findBestSpeaker,
  calculateOverlap,
};
