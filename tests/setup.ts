/**
 * Test setup utilities for Vitest
 */

import path from 'path';
import fs from 'fs';

export const PROJECT_ROOT = path.join(__dirname, '..');
export const TEST_FIXTURES_DIR = path.join(__dirname, 'diarization', 'fixtures');

/**
 * Ensure test fixtures directory exists.
 */
export function ensureTestFixturesDir(): void {
  if (!fs.existsSync(TEST_FIXTURES_DIR)) {
    fs.mkdirSync(TEST_FIXTURES_DIR, { recursive: true });
  }
}

/**
 * Find an existing audio file from previous transcriptions.
 * Useful for running diarization tests without needing to provide a test file.
 * @returns Path to audio file or null if none found
 */
export function findExistingAudioFile(): string | null {
  const transcriptionsDir = path.join(PROJECT_ROOT, 'transcriptions');

  if (!fs.existsSync(transcriptionsDir)) {
    return null;
  }

  const folders = fs
    .readdirSync(transcriptionsDir)
    .filter((f) => f.startsWith('transcription-'))
    .sort()
    .reverse(); // Most recent first

  for (const folder of folders) {
    const folderPath = path.join(transcriptionsDir, folder);
    try {
      const files = fs.readdirSync(folderPath);
      const audioFile = files.find((f) => f.endsWith('_audio_source.wav'));

      if (audioFile) {
        return path.join(folderPath, audioFile);
      }
    } catch {
      // Skip folders we can't read
    }
  }

  return null;
}

/**
 * Check if a test audio file is available.
 * @returns true if a test audio file exists
 */
export function hasTestAudioFile(): boolean {
  return findExistingAudioFile() !== null;
}
