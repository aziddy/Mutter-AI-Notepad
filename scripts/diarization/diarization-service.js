/**
 * Diarization Service
 *
 * Combines:
 * - whisper.cpp for transcription (Metal GPU accelerated on Mac)
 * - pyannote.audio for speaker diarization (CPU)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { TranscriptionService } = require('../../src/transcription');
const { alignSpeakers, parseSRT } = require('../../src/utils/align-speakers');

class DiarizationService {
  /**
   * Create a new DiarizationService instance.
   * @param {Object} options - Configuration options
   * @param {string} [options.hfToken] - Hugging Face token (or use HF_TOKEN env var)
   * @param {number} [options.minSpeakers] - Minimum number of speakers hint
   * @param {number} [options.maxSpeakers] - Maximum number of speakers hint
   */
  constructor(options = {}) {
    this.scriptDir = __dirname;
    this.pyannoteScript = path.join(this.scriptDir, 'run_pyannote.py');
    this.venvPython = path.join(this.scriptDir, 'venv', 'bin', 'python');
    this.hfToken = options.hfToken || process.env.HF_TOKEN;
    this.minSpeakers = options.minSpeakers;
    this.maxSpeakers = options.maxSpeakers;
    this.transcriptionService = new TranscriptionService();
  }

  /**
   * Check if the environment is properly set up.
   * @returns {Promise<{ready: boolean, message: string, details: Object}>}
   */
  async checkEnvironment() {
    const checks = {
      pyannoteScript: fs.existsSync(this.pyannoteScript),
      venvExists: fs.existsSync(this.venvPython),
      hfTokenSet: !!this.hfToken,
      whisperReady: false,
    };

    // Check whisper.cpp
    try {
      await this.transcriptionService.initialize();
      checks.whisperReady = true;
    } catch (e) {
      checks.whisperError = e.message;
    }

    const ready =
      checks.pyannoteScript && checks.venvExists && checks.whisperReady;
    const messages = [];

    if (!checks.pyannoteScript) {
      messages.push(`Pyannote script not found: ${this.pyannoteScript}`);
    }
    if (!checks.venvExists) {
      messages.push(
        'Virtual environment not found. Run: cd scripts/diarization && bash setup-pyannote.sh'
      );
    }
    if (!checks.whisperReady) {
      messages.push(`Whisper not ready: ${checks.whisperError || 'unknown'}`);
    }
    if (!checks.hfTokenSet) {
      messages.push(
        'HF_TOKEN not set. Diarization requires a Hugging Face token.'
      );
    }

    return {
      ready,
      message: ready ? 'Environment ready' : messages.join('; '),
      details: checks,
    };
  }

  /**
   * Run pyannote speaker diarization.
   * @param {string} audioPath - Path to audio file
   * @param {Function} [onProgress] - Progress callback
   * @returns {Promise<{success: boolean, segments: Array, speakers: Array}>}
   */
  async runPyannote(audioPath, onProgress) {
    return new Promise((resolve, reject) => {
      const python = this.venvPython;

      const args = [this.pyannoteScript, audioPath];

      if (this.hfToken) {
        args.push('--hf-token', this.hfToken);
      }
      if (this.minSpeakers) {
        args.push('--min-speakers', String(this.minSpeakers));
      }
      if (this.maxSpeakers) {
        args.push('--max-speakers', String(this.maxSpeakers));
      }

      console.log(`[Diarization] Running pyannote: ${python}`);

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
        const lines = message.trim().split('\n');
        lines.forEach((line) => {
          if (line.trim()) {
            console.log(`[Pyannote] ${line}`);
            if (onProgress) onProgress(line);
          }
        });
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            // Extract JSON from stdout
            const firstBrace = stdout.indexOf('{');
            const lastBrace = stdout.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
              const jsonStr = stdout.substring(firstBrace, lastBrace + 1);
              const result = JSON.parse(jsonStr);
              resolve(result);
            } else {
              reject(new Error('No JSON output from pyannote'));
            }
          } catch (e) {
            reject(new Error(`Failed to parse pyannote output: ${e.message}`));
          }
        } else {
          reject(new Error(`Pyannote failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to start pyannote: ${error.message}`));
      });
    });
  }

  /**
   * Run hybrid diarization pipeline.
   * @param {string} audioPath - Path to audio file
   * @param {Object} [options] - Override options
   * @param {Function} [options.onProgress] - Progress callback
   * @returns {Promise<Object>} - Combined result with transcription and speaker assignments
   */
  async diarize(audioPath, options = {}) {
    const startTime = Date.now();

    console.log('[Diarization] Starting hybrid diarization pipeline');
    console.log('[Diarization] Step 1: Running whisper.cpp (Metal GPU)...');

    // Step 1: Run whisper.cpp for transcription
    let transcription;
    try {
      transcription = await this.transcriptionService.transcribe(audioPath);
      console.log('[Diarization] Whisper transcription complete');
    } catch (error) {
      return {
        success: false,
        error: 'TranscriptionError',
        message: `Whisper transcription failed: ${error.message}`,
      };
    }

    // Step 2: Run pyannote for speaker diarization
    console.log('[Diarization] Step 2: Running pyannote (CPU)...');

    let pyannoteResult;
    try {
      pyannoteResult = await this.runPyannote(audioPath, options.onProgress);
      console.log('[Diarization] Pyannote diarization complete');
    } catch (error) {
      return {
        success: false,
        error: 'DiarizationError',
        message: `Pyannote diarization failed: ${error.message}`,
      };
    }

    if (!pyannoteResult.success) {
      return pyannoteResult;
    }

    // Step 3: Align transcription with speaker segments
    console.log('[Diarization] Step 3: Aligning speakers with transcription...');

    // Parse SRT from whisper output
    let whisperSegments = [];
    if (transcription.srt) {
      whisperSegments = parseSRT(transcription.srt);
    } else if (transcription.json && transcription.json.transcription) {
      // Parse from JSON
      whisperSegments = transcription.json.transcription.map((item) => ({
        start: parseTimestamp(item.timestamps.from),
        end: parseTimestamp(item.timestamps.to),
        text: item.text.trim(),
      }));
    }

    const alignedSegments = alignSpeakers(
      whisperSegments,
      pyannoteResult.segments
    );

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[Diarization] Pipeline complete in ${duration.toFixed(1)}s`);

    // Build final result
    return {
      success: true,
      text: transcription.text,
      segments: alignedSegments,
      speakers: pyannoteResult.speakers || [],
      language: 'en', // whisper.cpp defaults to en
      metadata: {
        whisper: 'whisper.cpp (Metal GPU)',
        diarization: 'pyannote.audio (CPU)',
        processing_time_seconds: duration,
        num_segments: alignedSegments.length,
        num_speakers: (pyannoteResult.speakers || []).length,
      },
    };
  }
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

module.exports = { DiarizationService };
