/**
 * Vitest tests for WhisperX speaker diarization
 */

import { describe, it, expect, beforeAll, test } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  getFixtureAudioFiles,
  loadFixtureMetadata,
  PROJECT_ROOT,
} from '../setup';

// Path to the diarization service
const DIARIZATION_SERVICE_PATH = path.join(
  PROJECT_ROOT,
  'scripts',
  'diarization',
  'diarization-service.js'
);

interface DiarizationSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: unknown[];
}

interface DiarizationResult {
  success: boolean;
  text?: string;
  segments?: DiarizationSegment[];
  speakers?: string[];
  language?: string;
  metadata?: {
    model: string;
    diarization_enabled: boolean;
    compute_type: string;
    device: string;
  };
  error?: string;
  message?: string;
}

interface DiarizationServiceClass {
  new (options?: {
    hfToken?: string;
    model?: string;
    device?: string;
    computeType?: string;
  }): {
    checkEnvironment(): Promise<{
      ready: boolean;
      message: string;
      details: {
        pythonScript: boolean;
        venvExists: boolean;
        hfTokenSet: boolean;
      };
    }>;
    diarize(
      audioPath: string,
      options?: Record<string, unknown>
    ): Promise<DiarizationResult>;
  };
}

// Dynamic require for CommonJS module
function loadDiarizationService(): DiarizationServiceClass {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DiarizationService } = require(DIARIZATION_SERVICE_PATH);
  return DiarizationService;
}

// Load fixtures at module level so they're available for test definition
const testAudioFiles = getFixtureAudioFiles();

// Timeout per fixture (5 minutes each)
const TIMEOUT_PER_FIXTURE = 300000;
const TEST_TIMEOUT = TIMEOUT_PER_FIXTURE * Math.max(testAudioFiles.length, 1);

// Cache diarization results: audioPath -> result
// Populated in beforeAll, used by all tests
const diarizationResults = new Map<string, DiarizationResult>();

describe('Speaker Diarization', () => {
  let DiarizationService: DiarizationServiceClass;
  let service: InstanceType<DiarizationServiceClass>;
  let environmentReady: boolean;

  beforeAll(async () => {
    DiarizationService = loadDiarizationService();
    service = new DiarizationService();

    const envCheck = await service.checkEnvironment();
    environmentReady = envCheck.ready;

    // Run diarization ONCE for each fixture and cache results
    if (environmentReady && testAudioFiles.length > 0) {
      for (const audioFile of testAudioFiles) {
        const result = await service.diarize(audioFile);
        diarizationResults.set(audioFile, result);
      }
    }
  }, TEST_TIMEOUT);

  describe('Environment Check', () => {
    it('should have Python script present', () => {
      const pythonScript = path.join(
        PROJECT_ROOT,
        'scripts',
        'diarization',
        'run_whisperx.py'
      );
      expect(fs.existsSync(pythonScript)).toBe(true);
    });

    it('should have Node.js service present', () => {
      expect(fs.existsSync(DIARIZATION_SERVICE_PATH)).toBe(true);
    });

    it('should return environment status object', async () => {
      const envCheck = await service.checkEnvironment();

      expect(envCheck).toHaveProperty('ready');
      expect(envCheck).toHaveProperty('message');
      expect(envCheck).toHaveProperty('details');
      expect(typeof envCheck.ready).toBe('boolean');
      expect(typeof envCheck.message).toBe('string');
    });

    it('should include all environment check details', async () => {
      const envCheck = await service.checkEnvironment();

      expect(envCheck.details).toHaveProperty('pythonScript');
      expect(envCheck.details).toHaveProperty('venvExists');
      expect(envCheck.details).toHaveProperty('hfTokenSet');
    });
  });

  describe('Diarization Processing', () => {
    test.skipIf(testAudioFiles.length === 0)(
      'should process audio files and return result objects',
      async (ctx) => {
        if (!environmentReady) ctx.skip();
        for (const audioFile of testAudioFiles) {
          const result = diarizationResults.get(audioFile);

          expect(result).toBeDefined();
          expect(typeof result!.success).toBe('boolean');
        }
      }
    );

    test.skipIf(testAudioFiles.length === 0)(
      'should return text in successful results',
      async (ctx) => {
        if (!environmentReady) ctx.skip();
        for (const audioFile of testAudioFiles) {
          const result = diarizationResults.get(audioFile)!;

          if (result.success) {
            expect(result.text).toBeDefined();
            expect(typeof result.text).toBe('string');
            expect(result.text!.length).toBeGreaterThan(0);
          }
        }
      }
    );

    test.skipIf(testAudioFiles.length === 0)(
      'should return segments array',
      async (ctx) => {
        if (!environmentReady) ctx.skip();
        for (const audioFile of testAudioFiles) {
          const result = diarizationResults.get(audioFile)!;

          if (result.success) {
            expect(Array.isArray(result.segments)).toBe(true);
            expect(result.segments!.length).toBeGreaterThan(0);
          }
        }
      }
    );

    test.skipIf(testAudioFiles.length === 0)(
      'should have valid segment timestamps',
      async (ctx) => {
        if (!environmentReady) ctx.skip();
        for (const audioFile of testAudioFiles) {
          const result = diarizationResults.get(audioFile)!;

          if (result.success && result.segments) {
            result.segments.forEach((segment) => {
              expect(typeof segment.start).toBe('number');
              expect(typeof segment.end).toBe('number');
              expect(segment.start).toBeGreaterThanOrEqual(0);
              expect(segment.end).toBeGreaterThan(segment.start);
              expect(typeof segment.text).toBe('string');
            });
          }
        }
      }
    );

    test.skipIf(testAudioFiles.length === 0 || !process.env.HF_TOKEN)(
      'should have speaker assignments when HF_TOKEN is set',
      async (ctx) => {
        if (!environmentReady) ctx.skip();
        for (const audioFile of testAudioFiles) {
          const result = diarizationResults.get(audioFile)!;

          if (result.success) {
            const segmentsWithSpeakers = result.segments!.filter((s) => s.speaker);
            expect(segmentsWithSpeakers.length).toBeGreaterThan(0);
          }
        }
      }
    );

    test.skipIf(testAudioFiles.length === 0 || !process.env.HF_TOKEN)(
      'should identify correct number of speakers per fixture',
      async (ctx) => {
        if (!environmentReady) ctx.skip();
        for (const audioFile of testAudioFiles) {
          const metadata = loadFixtureMetadata(audioFile);
          const result = diarizationResults.get(audioFile)!;

          if (result.success) {
            expect(result.speakers?.length).toBe(metadata.expectedSpeakers);
          }
        }
      }
    );

    test.skipIf(testAudioFiles.length === 0)(
      'should include metadata in result',
      async (ctx) => {
        if (!environmentReady) ctx.skip();
        for (const audioFile of testAudioFiles) {
          const result = diarizationResults.get(audioFile)!;

          if (result.success) {
            expect(result.metadata).toBeDefined();
            expect(result.metadata).toHaveProperty('model');
            expect(result.metadata).toHaveProperty('diarization_enabled');
            expect(result.metadata).toHaveProperty('device');
          }
        }
      }
    );
  });

  describe('Error Handling', () => {
    test(
      'should handle non-existent file gracefully',
      async (ctx) => {
        if (!environmentReady) ctx.skip();
        const result = await service.diarize('/nonexistent/path/to/file.wav');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.message).toBeDefined();
      }
    );

    test(
      'should handle invalid file format gracefully',
      async (ctx) => {
        if (!environmentReady) ctx.skip();
        // Try to process package.json as audio (will fail)
        const invalidFile = path.join(PROJECT_ROOT, 'package.json');
        const result = await service.diarize(invalidFile);

        expect(result.success).toBe(false);
      },
      60000
    );
  });
});
