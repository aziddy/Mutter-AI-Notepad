const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { transcribeAudio } = require('./transcription');
const { generateSummary, askQuestion, generateInsights } = require('./llm');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers
ipcMain.handle('select-file', async () => {
  console.log('select-file');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      {
        name: 'Audio/Video Files',
        extensions: ['mp3', 'wav', 'mp4', 'mov', 'avi', 'mkv', 'm4a', 'flac', 'ogg']
      }
    ]
  });
  console.log('select-file result.filePaths', result.filePaths);
  console.log('select-file result.filePaths[0]', result.filePaths[0]);
  return result.filePaths[0];
});

ipcMain.handle('transcribe-file', async (event, filePath) => {
  console.log('transcribe-file given file path =', filePath);
  try {
    const result = await transcribeAudio(filePath);
    
    // Save transcription to text, JSON, and SRT files
    console.log('transcribe-file generating save paths');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `transcription-${timestamp}`;
    const textFileName = `${baseFileName}.txt`;
    const jsonFileName = `${baseFileName}.json`;
    const srtFileName = `${baseFileName}.srt`;
    const saveDir = path.join(process.cwd(), 'transcriptions');
    
    console.log('transcribe-file save dir =', saveDir);
    
    // Ensure transcriptions directory exists
    await fs.mkdir(saveDir, { recursive: true });
    
    // Save text file
    const textPath = path.join(saveDir, textFileName);
    await fs.writeFile(textPath, result.text);
    
    // Save SRT file if available
    let srtPath = null;
    if (result.srt) {
      console.log('transcribe-file saving SRT file');
      srtPath = path.join(saveDir, srtFileName);
      await fs.writeFile(srtPath, result.srt);
    }
    
    // Save JSON file with metadata
    const jsonData = {
      text: result.text,
      segments: result.json?.segments || [],
      language: result.json?.language || 'en',
      metadata: {
        originalFile: filePath,
        transcribedAt: new Date().toISOString(),
        duration: result.json?.duration || null,
        wordCount: result.text.split(/\s+/).length
      }
    };
    
    const jsonPath = path.join(saveDir, jsonFileName);
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));
    
    return {
      transcription: result.text,
      jsonData: jsonData,
      srt: result.srt,
      savedPath: textPath,
      jsonPath: jsonPath,
      srtPath: srtPath,
      fileName: textFileName,
      jsonFileName: jsonFileName,
      srtFileName: srtFileName
    };
  } catch (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }
});

ipcMain.handle('generate-summary', async (event, transcription, apiKey) => {
  try {
    return await generateSummary(transcription, apiKey);
  } catch (error) {
    throw new Error(`Summary generation failed: ${error.message}`);
  }
});

ipcMain.handle('ask-question', async (event, transcription, question, apiKey) => {
  try {
    return await askQuestion(transcription, question, apiKey);
  } catch (error) {
    throw new Error(`Question answering failed: ${error.message}`);
  }
});

ipcMain.handle('generate-insights', async (event, transcription, apiKey) => {
  try {
    return await generateInsights(transcription, apiKey);
  } catch (error) {
    throw new Error(`Insights generation failed: ${error.message}`);
  }
});

ipcMain.handle('get-transcriptions', async () => {
  try {
    const transcriptionsDir = path.join(process.cwd(), 'transcriptions');
    await fs.mkdir(transcriptionsDir, { recursive: true });
    
    const files = await fs.readdir(transcriptionsDir);
    const transcriptions = [];
    const processedFiles = new Set();
    
    // First, process JSON files (they contain more metadata)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(transcriptionsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        try {
          const jsonData = JSON.parse(content);
          const baseFileName = file.replace('.json', '');
          
          // Check if SRT file exists for this transcription
          const srtFilePath = path.join(transcriptionsDir, `${baseFileName}.srt`);
          const hasSrt = await fs.access(srtFilePath).then(() => true).catch(() => false);
          
          // Load SRT content if available
          let srtData = null;
          if (hasSrt) {
            try {
              srtData = await fs.readFile(srtFilePath, 'utf-8');
            } catch (error) {
              console.error('Failed to read SRT file:', srtFilePath, error);
            }
          }
          
          transcriptions.push({
            fileName: baseFileName,
            content: jsonData.text,
            jsonData: jsonData,
            srtData: srtData,
            createdAt: stats.birthtime,
            size: stats.size,
            hasJson: true,
            hasSrt: hasSrt
          });
          
          processedFiles.add(baseFileName);
        } catch (error) {
          console.error('Failed to parse JSON file:', file, error);
        }
      }
    }
    
    // Then process text files that don't have corresponding JSON files
    for (const file of files) {
      if (file.endsWith('.txt')) {
        const baseFileName = file.replace('.txt', '');
        
        // Skip if we already processed this file as JSON
        if (processedFiles.has(baseFileName)) {
          continue;
        }
        
        const filePath = path.join(transcriptionsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        // Check if SRT file exists for this transcription
        const srtFilePath = path.join(transcriptionsDir, `${baseFileName}.srt`);
        const hasSrt = await fs.access(srtFilePath).then(() => true).catch(() => false);
        
        // Load SRT content if available
        let srtData = null;
        if (hasSrt) {
          try {
            srtData = await fs.readFile(srtFilePath, 'utf-8');
          } catch (error) {
            console.error('Failed to read SRT file:', srtFilePath, error);
          }
        }
        
        transcriptions.push({
          fileName: baseFileName,
          content,
          jsonData: null,
          srtData: srtData,
          createdAt: stats.birthtime,
          size: stats.size,
          hasJson: false,
          hasSrt: hasSrt
        });
      }
    }
    
    return transcriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('Error loading transcriptions:', error);
    return [];
  }
}); 