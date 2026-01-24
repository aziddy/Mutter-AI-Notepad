/**
 * FluidAudio Speaker Diarization Runner
 *
 * Runs the FluidAudio CLI (Swift/CoreML) for fast speaker diarization on macOS.
 * ~50x faster than pyannote but slightly less accurate (15-17% DER vs 7-12%).
 *
 * Usage:
 *   node run_fluidaudio.js <audio_file> [--output <path>]
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const FLUIDAUDIO_CLI = path.join(
  __dirname,
  'FluidAudio',
  '.build',
  'release',
  'fluidaudiocli'
);

/**
 * Run FluidAudio diarization on an audio file.
 * @param {string} audioPath - Path to audio file
 * @param {Object} options - Options
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<{success: boolean, segments: Array, speakers: Array, metadata: Object}>}
 */
async function runFluidAudio(audioPath, options = {}) {
  return new Promise((resolve, reject) => {
    // Check if CLI exists
    if (!fs.existsSync(FLUIDAUDIO_CLI)) {
      reject(
        new Error(
          `FluidAudio CLI not found at ${FLUIDAUDIO_CLI}. Run: cd scripts/diarization/FluidAudio && swift build -c release`
        )
      );
      return;
    }

    // Check if audio file exists
    if (!fs.existsSync(audioPath)) {
      reject(new Error(`Audio file not found: ${audioPath}`));
      return;
    }

    // Create temp output file
    const tempOutput = path.join(
      os.tmpdir(),
      `fluidaudio-${Date.now()}.json`
    );

    const args = ['process', audioPath, '--mode', 'offline', '--output', tempOutput];

    if (options.onProgress) {
      options.onProgress('Starting FluidAudio diarization...');
    }

    const proc = spawn(FLUIDAUDIO_CLI, args, {
      cwd: __dirname,
    });

    let stderr = '';

    proc.stdout.on('data', (data) => {
      const message = data.toString().trim();
      if (message && options.onProgress) {
        options.onProgress(message);
      }
    });

    proc.stderr.on('data', (data) => {
      const message = data.toString();
      stderr += message;
      if (options.onProgress) {
        const lines = message.trim().split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            options.onProgress(`[FluidAudio] ${line}`);
          }
        });
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          // Read and parse the output JSON
          const outputContent = fs.readFileSync(tempOutput, 'utf-8');
          const fluidResult = JSON.parse(outputContent);

          // Convert FluidAudio format to pyannote-compatible format
          const result = convertFluidAudioOutput(fluidResult, audioPath);

          // Clean up temp file
          try {
            fs.unlinkSync(tempOutput);
          } catch (e) {
            // Ignore cleanup errors
          }

          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse FluidAudio output: ${e.message}`));
        }
      } else {
        reject(new Error(`FluidAudio failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to start FluidAudio: ${error.message}`));
    });
  });
}

/**
 * Convert FluidAudio output format to pyannote-compatible format.
 *
 * FluidAudio format:
 *   { segments: [{ speakerId: "speaker_0", startTimeSeconds: 0.0, endTimeSeconds: 5.2, ... }] }
 *
 * Pyannote format:
 *   { segments: [{ speaker: "SPEAKER_00", start: 0.0, end: 5.2 }], speakers: ["SPEAKER_00"] }
 *
 * @param {Object} fluidResult - FluidAudio JSON output
 * @param {string} audioPath - Original audio path for metadata
 * @returns {Object} Pyannote-compatible result
 */
function convertFluidAudioOutput(fluidResult, audioPath) {
  const speakersSet = new Set();
  const segments = [];

  // Map FluidAudio speaker IDs to pyannote-style IDs
  const speakerIdMap = {};
  let speakerCounter = 0;

  for (const seg of fluidResult.segments || []) {
    // Get or create mapped speaker ID
    let mappedSpeaker;
    if (speakerIdMap[seg.speakerId] !== undefined) {
      mappedSpeaker = speakerIdMap[seg.speakerId];
    } else {
      mappedSpeaker = `SPEAKER_${String(speakerCounter).padStart(2, '0')}`;
      speakerIdMap[seg.speakerId] = mappedSpeaker;
      speakerCounter++;
    }

    speakersSet.add(mappedSpeaker);

    segments.push({
      speaker: mappedSpeaker,
      start: seg.startTimeSeconds,
      end: seg.endTimeSeconds,
    });
  }

  const speakers = Array.from(speakersSet).sort();

  return {
    success: true,
    segments,
    speakers,
    metadata: {
      audio_file: audioPath,
      backend: 'fluidaudio',
      device: 'CoreML/ANE',
      num_segments: segments.length,
      num_speakers: speakers.length,
      processing_time_seconds: fluidResult.processingTimeSeconds,
      real_time_factor: fluidResult.realTimeFactor,
      duration_seconds: fluidResult.durationSeconds,
    },
  };
}

/**
 * Check if FluidAudio is available.
 * @returns {{available: boolean, message: string}}
 */
function checkFluidAudioAvailable() {
  if (process.platform !== 'darwin') {
    return {
      available: false,
      message: 'FluidAudio is only available on macOS',
    };
  }

  if (!fs.existsSync(FLUIDAUDIO_CLI)) {
    return {
      available: false,
      message: `FluidAudio CLI not found. Run: cd scripts/diarization/FluidAudio && swift build -c release`,
    };
  }

  return {
    available: true,
    message: 'FluidAudio CLI ready',
  };
}

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node run_fluidaudio.js <audio_file> [--output <path>]');
    process.exit(1);
  }

  const audioFile = args[0];
  let outputPath = null;

  const outputIdx = args.indexOf('--output');
  if (outputIdx !== -1 && args[outputIdx + 1]) {
    outputPath = args[outputIdx + 1];
  }

  console.error(`[FluidAudio] Processing: ${audioFile}`);

  runFluidAudio(audioFile, {
    onProgress: (msg) => console.error(msg),
  })
    .then((result) => {
      const jsonOutput = JSON.stringify(result, null, 2);

      if (outputPath) {
        fs.writeFileSync(outputPath, jsonOutput);
        console.error(`[FluidAudio] Output written to: ${outputPath}`);
      } else {
        console.log(jsonOutput);
      }
    })
    .catch((error) => {
      console.error(`[FluidAudio] Error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  runFluidAudio,
  checkFluidAudioAvailable,
  convertFluidAudioOutput,
  FLUIDAUDIO_CLI,
};
