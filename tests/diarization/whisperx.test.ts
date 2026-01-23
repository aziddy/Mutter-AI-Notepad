/**
 * Vitest tests for WhisperX speaker diarization
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { findExistingAudioFile, PROJECT_ROOT } from '../setup';

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

describe('Speaker Diarization', () => {
  let DiarizationService: DiarizationServiceClass;
  let testAudioFile: string | null;
  let service: InstanceType<DiarizationServiceClass>;
  let environmentReady: boolean;

  beforeAll(async () => {
    DiarizationService = loadDiarizationService();
    service = new DiarizationService();
    testAudioFile = findExistingAudioFile();

    const envCheck = await service.checkEnvironment();
    environmentReady = envCheck.ready;
  });

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
    it.skipIf(!environmentReady || !testAudioFile)(
      'should process audio file and return result object',
      async () => {
        expect(testAudioFile).not.toBeNull();

        const result = await service.diarize(testAudioFile!);

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      },
      300000 // 5 minute timeout
    );

    it.skipIf(!environmentReady || !testAudioFile)(
      'should return text in successful result',
      async () => {
        const result = await service.diarize(testAudioFile!);

        if (result.success) {
          expect(result.text).toBeDefined();
          expect(typeof result.text).toBe('string');
          expect(result.text!.length).toBeGreaterThan(0);
        }
      },
      300000
    );

    it.skipIf(!environmentReady || !testAudioFile)(
      'should return segments array',
      async () => {
        const result = await service.diarize(testAudioFile!);

        if (result.success) {
          expect(Array.isArray(result.segments)).toBe(true);
          expect(result.segments!.length).toBeGreaterThan(0);
        }
      },
      300000
    );

    it.skipIf(!environmentReady || !testAudioFile)(
      'should have valid segment timestamps',
      async () => {
        const result = await service.diarize(testAudioFile!);

        if (result.success && result.segments) {
          result.segments.forEach((segment) => {
            expect(typeof segment.start).toBe('number');
            expect(typeof segment.end).toBe('number');
            expect(segment.start).toBeGreaterThanOrEqual(0);
            expect(segment.end).toBeGreaterThan(segment.start);
            expect(typeof segment.text).toBe('string');
          });
        }
      },
      300000
    );

    it.skipIf(!environmentReady || !testAudioFile || !process.env.HF_TOKEN)(
      'should have speaker assignments when HF_TOKEN is set',
      async () => {
        const result = await service.diarize(testAudioFile!);

        if (result.success) {
          const segmentsWithSpeakers = result.segments!.filter((s) => s.speaker);
          expect(segmentsWithSpeakers.length).toBeGreaterThan(0);
        }
      },
      300000
    );

    it.skipIf(!environmentReady || !testAudioFile || !process.env.HF_TOKEN)(
      'should return unique speakers list',
      async () => {
        const result = await service.diarize(testAudioFile!);

        if (result.success) {
          expect(Array.isArray(result.speakers)).toBe(true);
          expect(result.speakers!.length).toBeGreaterThanOrEqual(1);
        }
      },
      300000
    );

    it.skipIf(!environmentReady || !testAudioFile)(
      'should include metadata in result',
      async () => {
        const result = await service.diarize(testAudioFile!);

        if (result.success) {
          expect(result.metadata).toBeDefined();
          expect(result.metadata).toHaveProperty('model');
          expect(result.metadata).toHaveProperty('diarization_enabled');
          expect(result.metadata).toHaveProperty('device');
        }
      },
      300000
    );
  });

  describe('Error Handling', () => {
    it.skipIf(!environmentReady)(
      'should handle non-existent file gracefully',
      async () => {
        const result = await service.diarize('/nonexistent/path/to/file.wav');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.message).toBeDefined();
      }
    );

    it.skipIf(!environmentReady)(
      'should handle invalid file format gracefully',
      async () => {
        // Try to process package.json as audio (will fail)
        const invalidFile = path.join(PROJECT_ROOT, 'package.json');
        const result = await service.diarize(invalidFile);

        expect(result.success).toBe(false);
      },
      60000
    );
  });
});
