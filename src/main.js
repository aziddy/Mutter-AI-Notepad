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
    
    // Create individual folder for this transcription
    const transcriptionFolder = path.join(saveDir, baseFileName);
    await fs.mkdir(transcriptionFolder, { recursive: true });
    
    // Save text file
    const textPath = path.join(transcriptionFolder, textFileName);
    await fs.writeFile(textPath, result.text);
    
    // Save SRT file if available
    let srtPath = null;
    if (result.srt) {
      console.log('transcribe-file saving SRT file');
      srtPath = path.join(transcriptionFolder, srtFileName);
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
    
    const jsonPath = path.join(transcriptionFolder, jsonFileName);
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
      srtFileName: srtFileName,
      folderPath: transcriptionFolder
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
    
    const folders = await fs.readdir(transcriptionsDir);
    const transcriptions = [];
    
    // Process each transcription folder
    for (const folder of folders) {
      const folderPath = path.join(transcriptionsDir, folder);
      const folderStats = await fs.stat(folderPath);
      
      // Skip if it's not a directory or doesn't follow the transcription naming pattern
      if (!folderStats.isDirectory() || !folder.startsWith('transcription-')) {
        continue;
      }
      
      try {
        const files = await fs.readdir(folderPath);
        let jsonData = null;
        let textContent = null;
        let srtData = null;
        let hasJson = false;
        let hasSrt = false;
        
        // Look for files in the transcription folder
        for (const file of files) {
          if (file.endsWith('.json')) {
            const jsonPath = path.join(folderPath, file);
            const content = await fs.readFile(jsonPath, 'utf-8');
            jsonData = JSON.parse(content);
            textContent = jsonData.text;
            hasJson = true;
          } else if (file.endsWith('.txt')) {
            const txtPath = path.join(folderPath, file);
            textContent = await fs.readFile(txtPath, 'utf-8');
          } else if (file.endsWith('.srt')) {
            const srtPath = path.join(folderPath, file);
            srtData = await fs.readFile(srtPath, 'utf-8');
            hasSrt = true;
          }
        }
        
        // If we found content, add it to transcriptions
        if (textContent) {
          transcriptions.push({
            fileName: folder,
            content: textContent,
            jsonData: jsonData,
            srtData: srtData,
            createdAt: folderStats.birthtime,
            size: folderStats.size,
            hasJson: hasJson,
            hasSrt: hasSrt,
            folderPath: folderPath
          });
        }
      } catch (error) {
        console.error('Failed to process transcription folder:', folder, error);
      }
    }
    
    return transcriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('Error loading transcriptions:', error);
    return [];
  }
}); 