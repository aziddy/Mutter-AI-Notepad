#!/usr/bin/env node
/**
 * Manual test script for speaker diarization
 *
 * Usage:
 *   npm run test:diarization
 *   node scripts/test-diarization.js [audio_file]
 *
 * Environment:
 *   HF_TOKEN - Hugging Face token for diarization (required for speaker labels)
 *   Can be set in .env file at project root
 */

// Load .env file from project root
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const { DiarizationService } = require('./diarization/diarization-service');

// Configuration
const CONFIG = {
  expectedMinSpeakers: 1,
  outputFile: 'diarization-test-output.json',
};

/**
 * Find an existing audio file from previous transcriptions.
 * @returns {string|null}
 */
function findTestAudioFile() {
  const transcriptionsDir = path.join(__dirname, '..', 'transcriptions');

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
    } catch (e) {
      // Skip folders we can't read
    }
  }

  return null;
}

/**
 * Format duration in seconds to human readable string.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}m ${secs}s`;
}

/**
 * Run the diarization test.
 * @param {string|null} audioFile
 */
async function runTests(audioFile) {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Speaker Diarization Test');
  console.log('='.repeat(60));
  console.log('');

  const service = new DiarizationService();

  // Step 1: Check environment
  console.log('[1/3] Checking environment...');
  console.log('');
  const envCheck = await service.checkEnvironment();

  console.log('  Python script:', envCheck.details.pythonScript ? 'Found' : 'MISSING');
  console.log('  Virtual env:  ', envCheck.details.venvExists ? 'Found' : 'MISSING');
  console.log('  HF_TOKEN:     ', envCheck.details.hfTokenSet ? 'Set' : 'NOT SET (diarization disabled)');
  console.log('');

  if (!envCheck.ready) {
    console.error('Environment not ready!');
    console.error('');
    console.error('Setup instructions:');
    console.error('  1. cd scripts/diarization');
    console.error('  2. bash setup-whisperx.sh');
    console.error('  3. cp .env.example .env && edit .env to add HF_TOKEN');
    console.error('');
    console.error('See docs/add-speaker-diarization-plan.md for details.');
    process.exit(1);
  }

  // Step 2: Find or validate test audio file
  console.log('[2/3] Locating test audio file...');
  console.log('');

  if (!audioFile) {
    audioFile = findTestAudioFile();
  }

  if (!audioFile || !fs.existsSync(audioFile)) {
    console.error('No test audio file found!');
    console.error('');
    console.error('Options:');
    console.error('  1. Run a transcription first in the app to generate a test audio file');
    console.error('  2. Provide an audio file path:');
    console.error('     node scripts/test-diarization.js /path/to/audio.wav');
    console.error('');
    process.exit(1);
  }

  console.log('  Audio file:', audioFile);
  const stats = fs.statSync(audioFile);
  console.log('  File size: ', `${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  // Step 3: Run diarization
  console.log('[3/3] Running diarization...');
  console.log('');
  console.log('  This may take several minutes depending on audio length.');
  console.log('  Progress will be shown below.');
  console.log('');
  console.log('-'.repeat(60));

  const startTime = Date.now();

  try {
    const result = await service.diarize(audioFile, {
      onProgress: (msg) => {
        // Progress is already logged by the service
      },
    });

    const duration = (Date.now() - startTime) / 1000;

    console.log('-'.repeat(60));
    console.log('');
    console.log('='.repeat(60));
    console.log('  RESULTS');
    console.log('='.repeat(60));
    console.log('');

    if (result.success) {
      console.log('  Status:          SUCCESS');
      console.log('  Processing time:', formatDuration(duration));
      console.log('  Language:       ', result.language || 'unknown');
      console.log('  Speakers found: ', result.speakers?.length || 0);

      if (result.speakers && result.speakers.length > 0) {
        console.log('  Speaker IDs:    ', result.speakers.join(', '));
      }

      console.log('  Segments:       ', result.segments?.length || 0);
      console.log('');

      // Show sample segments
      if (result.segments && result.segments.length > 0) {
        console.log('  Sample segments (first 5):');
        console.log('');
        result.segments.slice(0, 5).forEach((seg, i) => {
          const speaker = seg.speaker || 'UNKNOWN';
          const time = `[${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s]`;
          const text =
            seg.text.length > 50
              ? seg.text.substring(0, 50) + '...'
              : seg.text;
          console.log(`    ${i + 1}. ${speaker} ${time}`);
          console.log(`       "${text}"`);
          console.log('');
        });
      }

      // Validation
      console.log('-'.repeat(60));
      console.log('  VALIDATION');
      console.log('-'.repeat(60));
      console.log('');

      const validations = [
        {
          name: 'Has segments',
          pass: result.segments && result.segments.length > 0,
        },
        {
          name: 'Has speaker assignments',
          pass: result.segments?.some((s) => s.speaker),
        },
        {
          name: `Found >= ${CONFIG.expectedMinSpeakers} speaker(s)`,
          pass: (result.speakers?.length || 0) >= CONFIG.expectedMinSpeakers,
        },
        {
          name: 'Has full text',
          pass: result.text && result.text.length > 0,
        },
      ];

      let allPassed = true;
      validations.forEach((v) => {
        const icon = v.pass ? '[PASS]' : '[FAIL]';
        console.log(`    ${icon} ${v.name}`);
        if (!v.pass) allPassed = false;
      });

      console.log('');
      console.log('='.repeat(60));
      if (allPassed) {
        console.log('  ALL TESTS PASSED');
      } else {
        console.log('  SOME TESTS FAILED');
        if (!envCheck.details.hfTokenSet) {
          console.log('');
          console.log('  Note: HF_TOKEN is not set, so speaker diarization was disabled.');
          console.log('  Set the token to enable speaker identification.');
        }
      }
      console.log('='.repeat(60));

      // Save full output
      const outputPath = path.join(__dirname, '..', CONFIG.outputFile);
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      console.log('');
      console.log(`Full output saved to: ${outputPath}`);
      console.log('');
    } else {
      console.log('  Status: FAILED');
      console.log('  Error: ', result.error);
      console.log('  Message:', result.message);
      console.log('');
      process.exit(1);
    }
  } catch (error) {
    console.log('-'.repeat(60));
    console.log('');
    console.error('Diarization failed with error:');
    console.error(error.message);
    console.error('');
    process.exit(1);
  }
}

// Parse command line args
const audioFile = process.argv[2] || null;

// Run
runTests(audioFile);
