/**
 * Utility to reconcile speaker labels from diarization with SRT segments.
 *
 * Takes SRT entries (from Whisper) and diarization result (from WhisperX)
 * and assigns the dominant speaker to each SRT segment based on timestamp overlap.
 */

/**
 * @typedef {Object} SRTEntry
 * @property {number} startTime - Start time in seconds
 * @property {number} endTime - End time in seconds
 * @property {string} text - Segment text
 */

/**
 * @typedef {Object} DiarizationWord
 * @property {string} word - The word text
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {number} score - Confidence score
 * @property {string} speaker - Speaker label (e.g., "SPEAKER_00")
 */

/**
 * @typedef {Object} DiarizationSegment
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} text - Segment text
 * @property {string} speaker - Speaker label
 * @property {DiarizationWord[]} words - Word-level data with speaker assignments
 */

/**
 * @typedef {Object} DiarizationResult
 * @property {boolean} success - Whether diarization succeeded
 * @property {DiarizationSegment[]} segments - Diarization segments with speaker labels
 * @property {string[]} speakers - List of unique speaker IDs
 */

/**
 * @typedef {Object} SRTEntryWithSpeaker
 * @property {number} startTime - Start time in seconds
 * @property {number} endTime - End time in seconds
 * @property {string} text - Segment text
 * @property {string|null} speaker - Assigned speaker label or null if no match
 * @property {number} confidence - Confidence of speaker assignment (0-1)
 */

/**
 * Parse SRT content into structured entries.
 * @param {string} srtContent - Raw SRT file content
 * @returns {SRTEntry[]}
 */
function parseSRT(srtContent) {
  const entries = [];
  const blocks = srtContent.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 2) continue;

    // Second line contains timestamp: "00:00:00,000 --> 00:00:05,000"
    const timeLine = lines[1];
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
    );

    if (!timeMatch) continue;

    const startTime =
      parseInt(timeMatch[1]) * 3600 +
      parseInt(timeMatch[2]) * 60 +
      parseInt(timeMatch[3]) +
      parseInt(timeMatch[4]) / 1000;

    const endTime =
      parseInt(timeMatch[5]) * 3600 +
      parseInt(timeMatch[6]) * 60 +
      parseInt(timeMatch[7]) +
      parseInt(timeMatch[8]) / 1000;

    // Text is everything after the timestamp line
    const text = lines.slice(2).join('\n').trim();

    entries.push({ startTime, endTime, text });
  }

  return entries;
}

/**
 * Extract all words with speaker assignments from diarization result.
 * @param {DiarizationResult} diarizationResult
 * @returns {DiarizationWord[]}
 */
function extractAllWords(diarizationResult) {
  const words = [];

  if (!diarizationResult.segments) return words;

  for (const segment of diarizationResult.segments) {
    if (segment.words && Array.isArray(segment.words)) {
      words.push(...segment.words);
    }
  }

  return words;
}

/**
 * Calculate overlap between two time ranges.
 * @param {number} start1
 * @param {number} end1
 * @param {number} start2
 * @param {number} end2
 * @returns {number} Overlap duration in seconds (0 if no overlap)
 */
function calculateOverlap(start1, end1, start2, end2) {
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Find the dominant speaker for a time range based on word-level data.
 * @param {number} startTime
 * @param {number} endTime
 * @param {DiarizationWord[]} words
 * @returns {{ speaker: string|null, confidence: number }}
 */
function findDominantSpeaker(startTime, endTime, words) {
  const speakerDurations = {};
  let totalOverlap = 0;

  for (const word of words) {
    if (!word.speaker) continue;

    const overlap = calculateOverlap(startTime, endTime, word.start, word.end);
    if (overlap > 0) {
      speakerDurations[word.speaker] =
        (speakerDurations[word.speaker] || 0) + overlap;
      totalOverlap += overlap;
    }
  }

  if (totalOverlap === 0) {
    return { speaker: null, confidence: 0 };
  }

  // Find speaker with maximum duration
  let maxDuration = 0;
  let dominantSpeaker = null;

  for (const [speaker, duration] of Object.entries(speakerDurations)) {
    if (duration > maxDuration) {
      maxDuration = duration;
      dominantSpeaker = speaker;
    }
  }

  const confidence = maxDuration / totalOverlap;
  return { speaker: dominantSpeaker, confidence };
}

/**
 * Reconcile speaker labels with SRT entries.
 *
 * @param {SRTEntry[]} srtEntries - Parsed SRT entries
 * @param {DiarizationResult} diarizationResult - Diarization output
 * @returns {SRTEntryWithSpeaker[]}
 */
function reconcileSpeakers(srtEntries, diarizationResult) {
  if (!diarizationResult || !diarizationResult.success) {
    // Return entries with null speakers if diarization failed
    return srtEntries.map((entry) => ({
      ...entry,
      speaker: null,
      confidence: 0,
    }));
  }

  const allWords = extractAllWords(diarizationResult);

  return srtEntries.map((entry) => {
    const { speaker, confidence } = findDominantSpeaker(
      entry.startTime,
      entry.endTime,
      allWords
    );

    return {
      ...entry,
      speaker,
      confidence,
    };
  });
}

/**
 * Reconcile speaker labels directly from SRT content string.
 *
 * @param {string} srtContent - Raw SRT file content
 * @param {DiarizationResult} diarizationResult - Diarization output
 * @returns {SRTEntryWithSpeaker[]}
 */
function reconcileSpeakersFromSRT(srtContent, diarizationResult) {
  const srtEntries = parseSRT(srtContent);
  return reconcileSpeakers(srtEntries, diarizationResult);
}

module.exports = {
  parseSRT,
  reconcileSpeakers,
  reconcileSpeakersFromSRT,
  extractAllWords,
  findDominantSpeaker,
  calculateOverlap,
};
