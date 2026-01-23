/**
 * Node.js Diarization Service
 * Wrapper for WhisperX Python script that handles speaker diarization.
 *
 * Usage:
 *   const { DiarizationService } = require('./diarization-service');
 *   const service = new DiarizationService();
 *   const result = await service.diarize('/path/to/audio.wav');
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * @typedef {Object} DiarizationSegment
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} text - Segment text
 * @property {string} [speaker] - Speaker ID (e.g., "SPEAKER_00")
 * @property {Array} [words] - Word-level alignments
 */

/**
 * @typedef {Object} DiarizationResult
 * @property {boolean} success - Whether diarization succeeded
 * @property {string} [text] - Full transcription text
 * @property {DiarizationSegment[]} [segments] - Segments with speaker assignments
 * @property {string[]} [speakers] - List of unique speaker IDs
 * @property {string} [language] - Detected language
 * @property {Object} [metadata] - Processing metadata
 * @property {string} [error] - Error type if failed
 * @property {string} [message] - Error message if failed
 */

/**
 * @typedef {Object} EnvironmentCheck
 * @property {boolean} ready - Whether environment is ready
 * @property {string} message - Status message
 * @property {Object} details - Detailed check results
 */

class DiarizationService {
  /**
   * Create a new DiarizationService instance.
   * @param {Object} options - Configuration options
   * @param {string} [options.hfToken] - Hugging Face token (or use HF_TOKEN env var)
   * @param {string} [options.model='large-v2'] - Whisper model to use
   * @param {string} [options.device='cpu'] - Device: cpu or cuda
   * @param {string} [options.computeType='int8'] - Compute type: int8, float16, float32
   */
  constructor(options = {}) {
    this.scriptDir = __dirname;
    this.pythonScript = path.join(this.scriptDir, 'run_whisperx.py');
    this.venvPython = path.join(this.scriptDir, 'venv', 'bin', 'python');
    this.hfToken = options.hfToken || process.env.HF_TOKEN;
    this.model = options.model || 'large-v2';
    this.device = options.device || 'cpu';
    this.computeType = options.computeType || 'int8';
  }

  /**
   * Check if the diarization environment is properly set up.
   * @returns {Promise<EnvironmentCheck>}
   */
  async checkEnvironment() {
    const checks = {
      pythonScript: fs.existsSync(this.pythonScript),
      venvExists: fs.existsSync(this.venvPython),
      hfTokenSet: !!this.hfToken,
    };

    const ready = checks.pythonScript && checks.venvExists;
    const messages = [];

    if (!checks.pythonScript) {
      messages.push(`Python script not found: ${this.pythonScript}`);
    }
    if (!checks.venvExists) {
      messages.push(
        'Virtual environment not found. Run: cd scripts/diarization && bash setup-whisperx.sh'
      );
    }
    if (!checks.hfTokenSet) {
      messages.push(
        'HF_TOKEN not set. Diarization will be disabled (transcription only).'
      );
    }

    return {
      ready,
      message: ready ? 'Environment ready' : messages.join('; '),
      details: checks,
    };
  }

  /**
   * Get the Python executable path (venv or system).
   * @returns {string}
   */
  getPythonPath() {
    if (fs.existsSync(this.venvPython)) {
      return this.venvPython;
    }
    return 'python3';
  }

  /**
   * Run speaker diarization on an audio file.
   * @param {string} audioPath - Path to audio file
   * @param {Object} [options] - Override options for this run
   * @param {string} [options.hfToken] - Hugging Face token
   * @param {string} [options.model] - Whisper model
   * @param {string} [options.device] - Device (cpu/cuda)
   * @param {string} [options.computeType] - Compute type
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<DiarizationResult>}
   */
  async diarize(audioPath, options = {}) {
    return new Promise((resolve, reject) => {
      const python = this.getPythonPath();

      const args = [
        this.pythonScript,
        audioPath,
        '--model',
        options.model || this.model,
        '--device',
        options.device || this.device,
        '--compute-type',
        options.computeType || this.computeType,
      ];

      // Add HF token if available
      const hfToken = options.hfToken || this.hfToken;
      if (hfToken) {
        args.push('--hf-token', hfToken);
      }

      console.log(`[Diarization] Using Python: ${python}`);
      // Mask HF token in log output
      const safeArgs = args.map((arg, i) =>
        args[i - 1] === '--hf-token' ? '***' : arg
      );
      console.log(`[Diarization] Running: ${safeArgs.join(' ')}`);

      const proc = spawn(python, args, {
        cwd: this.scriptDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        const message = data.toString();
        stderr += message;
        // Log progress messages
        const lines = message.trim().split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            console.log(`[Diarization] ${line}`);
            if (options.onProgress) {
              options.onProgress(line);
            }
          }
        });
      });

      proc.on('close', (code) => {
        // Extract JSON from output (whisperx logs may appear before the JSON)
        const extractJson = (output) => {
          // Find the first { and last } to extract JSON object
          const firstBrace = output.indexOf('{');
          const lastBrace = output.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return output.substring(firstBrace, lastBrace + 1);
          }
          return output;
        };

        if (code === 0) {
          try {
            const jsonStr = extractJson(stdout);
            const result = JSON.parse(jsonStr);
            resolve(result);
          } catch (parseError) {
            reject(
              new Error(
                `Failed to parse output: ${parseError.message}\nOutput: ${stdout}`
              )
            );
          }
        } else {
          // Try to parse error from stdout (our script outputs JSON errors)
          try {
            const jsonStr = extractJson(stdout);
            const errorResult = JSON.parse(jsonStr);
            resolve(errorResult); // Return the error result, not reject
          } catch {
            reject(
              new Error(`Diarization failed with code ${code}: ${stderr}`)
            );
          }
        }
      });

      proc.on('error', (error) => {
        reject(
          new Error(`Failed to start diarization process: ${error.message}`)
        );
      });
    });
  }
}

module.exports = { DiarizationService };
