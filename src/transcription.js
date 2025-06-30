const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

class TranscriptionService {
  constructor() {
    this.initialized = false;
    this.whisperPath = path.join(__dirname, '..', 'node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp', 'build', 'bin', 'whisper-cli');
    this.modelsPath = path.join(__dirname, '..', 'node_modules', 'nodejs-whisper', 'cpp', 'whisper.cpp', 'models');
  }

  async initialize() {
    if (!this.initialized) {
      // Check if whisper binary exists
      if (!fs.existsSync(this.whisperPath)) {
        throw new Error(`Whisper binary not found at: ${this.whisperPath}`);
      }
      
      // Check if model exists, if not download it
      const modelPath = path.join(this.modelsPath, 'ggml-base.en.bin');
      if (!fs.existsSync(modelPath)) {
        console.log('Model not found, downloading...');
        await this.downloadModel();
      }
      
      this.initialized = true;
      console.log('Whisper service initialized');
    }
  }

  async downloadModel() {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';
      const modelPath = path.join(this.modelsPath, 'ggml-base.en.bin');
      
      // Ensure models directory exists
      if (!fs.existsSync(this.modelsPath)) {
        fs.mkdirSync(this.modelsPath, { recursive: true });
      }
      
      console.log('Downloading model from:', modelUrl);
      const file = fs.createWriteStream(modelPath);
      
      https.get(modelUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download model: ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('Model downloaded successfully');
          resolve();
        });
        
        file.on('error', (err) => {
          fs.unlink(modelPath, () => {}); // Delete the file async
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  async convertToWav(inputPath) {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(path.dirname(inputPath), 
        `temp_${Date.now()}_${path.basename(inputPath, path.extname(inputPath))}.wav`);
      
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => {
          console.log('Audio conversion completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('Audio conversion error:', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  async transcribe(filePath) {
    try {
      await this.initialize();
      
      console.log(`Starting transcription for: ${filePath}`);
      
      // Check if file needs conversion
      const ext = path.extname(filePath).toLowerCase();
      let audioPath = filePath;
      let tempFile = false;
      
      if (!['.wav', '.mp3'].includes(ext)) {
        console.log('Converting file to WAV format...');
        audioPath = await this.convertToWav(filePath);
        tempFile = true;
      }
      
      // Use direct whisper binary call
      const modelPath = path.join(this.modelsPath, 'ggml-base.en.bin');
      const transcript = await this.runWhisper(audioPath, modelPath);
      
      // Clean up temporary file
      if (tempFile && fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      
      console.log('Transcription completed');
      return transcript;
      
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  async runWhisper(audioPath, modelPath) {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '-otxt',  // Output as text
        '-oj', // Output as JSON
        '-osrt', // Output as SRT
        '-l', 'en' // Language
      ];
      
      console.log('Running whisper with args:', args);
      console.log('Whisper binary path:', this.whisperPath);
      console.log('Working directory:', path.dirname(this.whisperPath));
      
      const whisperProcess = spawn(this.whisperPath, args, {
        cwd: path.dirname(this.whisperPath)
      });
      
      let stdout = '';
      let stderr = '';
      
      whisperProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Whisper stdout:', data.toString());
      });
      
      whisperProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Whisper stderr:', data.toString());
      });
      
      whisperProcess.on('close', (code) => {
        console.log('Whisper process exited with code:', code);
        console.log('Full stdout:', stdout);
        console.log('Full stderr:', stderr);
        
        if (code === 0) {
          // Read all output files - Whisper keeps the full filename including extension
          const textOutputFile = audioPath + '.txt';
          const jsonOutputFile = audioPath + '.json';
          const srtOutputFile = audioPath + '.srt';
          console.log('Looking for output files:', textOutputFile, jsonOutputFile, srtOutputFile);
          
          let transcript = '';
          let jsonData = null;
          let srtData = null;
          
          if (fs.existsSync(textOutputFile)) {
            transcript = fs.readFileSync(textOutputFile, 'utf8');
            console.log('Found text output file, content length:', transcript.length);
            // Clean up the text output file
            fs.unlinkSync(textOutputFile);
          } else {
            console.log('No text output file found, using stdout');
            transcript = stdout.trim();
          }
          
          if (fs.existsSync(jsonOutputFile)) {
            try {
              const jsonContent = fs.readFileSync(jsonOutputFile, 'utf8');
              jsonData = JSON.parse(jsonContent);
              console.log('Found JSON output file, parsed successfully');
              // Clean up the JSON output file
              fs.unlinkSync(jsonOutputFile);
            } catch (error) {
              console.error('Failed to parse JSON output:', error);
            }
          }
          
          if (fs.existsSync(srtOutputFile)) {
            try {
              srtData = fs.readFileSync(srtOutputFile, 'utf8');
              console.log('Found SRT output file, content length:', srtData.length);
              // Clean up the SRT output file
              fs.unlinkSync(srtOutputFile);
            } catch (error) {
              console.error('Failed to read SRT output:', error);
            }
          }
          
          resolve({
            text: transcript.trim(),
            json: jsonData,
            srt: srtData
          });
        } else {
          reject(new Error(`Whisper process failed with code ${code}. stderr: ${stderr}`));
        }
      });
      
      whisperProcess.on('error', (error) => {
        console.error('Whisper process error:', error);
        reject(new Error(`Failed to start whisper process: ${error.message}`));
      });
    });
  }
}

const transcriptionService = new TranscriptionService();

async function transcribeAudio(filePath) {
  return await transcriptionService.transcribe(filePath);
}

module.exports = {
  transcribeAudio,
  TranscriptionService
}; 