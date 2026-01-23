/**
 * Utility to format reconciled SRT entries into a speaker-labeled transcript.
 *
 * Output format:
 * [SPEAKER_00] Hello, how are you
 * [SPEAKER_01] I'm doing good, how are you?
 * [SPEAKER_00] Also doing good
 */

/**
 * @typedef {Object} ReconciledEntry
 * @property {number} startTime
 * @property {number} endTime
 * @property {string} text
 * @property {string|null} speaker
 * @property {number} confidence
 */

/**
 * Format reconciled entries into a speaker-labeled transcript.
 * Groups consecutive entries by the same speaker into single lines.
 *
 * @param {ReconciledEntry[]} reconciledEntries
 * @returns {string}
 */
function formatSpeakerTranscript(reconciledEntries) {
  if (!reconciledEntries || reconciledEntries.length === 0) {
    return '';
  }

  const lines = [];
  let currentSpeaker = null;
  let currentText = [];

  for (const entry of reconciledEntries) {
    const speaker = entry.speaker || 'UNKNOWN';

    if (speaker !== currentSpeaker) {
      // Flush previous speaker's text
      if (currentSpeaker !== null && currentText.length > 0) {
        lines.push(`[${currentSpeaker}] ${currentText.join(' ')}`);
      }
      // Start new speaker
      currentSpeaker = speaker;
      currentText = [entry.text.trim()];
    } else {
      // Same speaker, append text
      currentText.push(entry.text.trim());
    }
  }

  // Flush last speaker
  if (currentSpeaker !== null && currentText.length > 0) {
    lines.push(`[${currentSpeaker}] ${currentText.join(' ')}`);
  }

  return lines.join('\n');
}

/**
 * Format reconciled entries with timestamps included.
 *
 * Output format:
 * [00:00:00] [SPEAKER_00] Hello, how are you
 * [00:00:05] [SPEAKER_01] I'm doing good, how are you?
 *
 * @param {ReconciledEntry[]} reconciledEntries
 * @returns {string}
 */
function formatSpeakerTranscriptWithTimestamps(reconciledEntries) {
  if (!reconciledEntries || reconciledEntries.length === 0) {
    return '';
  }

  const lines = [];
  let currentSpeaker = null;
  let currentText = [];
  let currentStartTime = 0;

  for (const entry of reconciledEntries) {
    const speaker = entry.speaker || 'UNKNOWN';

    if (speaker !== currentSpeaker) {
      // Flush previous speaker's text
      if (currentSpeaker !== null && currentText.length > 0) {
        const timestamp = formatTimestamp(currentStartTime);
        lines.push(`[${timestamp}] [${currentSpeaker}] ${currentText.join(' ')}`);
      }
      // Start new speaker
      currentSpeaker = speaker;
      currentText = [entry.text.trim()];
      currentStartTime = entry.startTime;
    } else {
      // Same speaker, append text
      currentText.push(entry.text.trim());
    }
  }

  // Flush last speaker
  if (currentSpeaker !== null && currentText.length > 0) {
    const timestamp = formatTimestamp(currentStartTime);
    lines.push(`[${timestamp}] [${currentSpeaker}] ${currentText.join(' ')}`);
  }

  return lines.join('\n');
}

/**
 * Format seconds to HH:MM:SS timestamp.
 * @param {number} seconds
 * @returns {string}
 */
function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

module.exports = {
  formatSpeakerTranscript,
  formatSpeakerTranscriptWithTimestamps,
  formatTimestamp,
};
