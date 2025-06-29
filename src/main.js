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
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
    const transcription = await transcribeAudio(filePath);
    
    // Save transcription to file
    console.log('transcribe-file generateing save path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `transcription-${timestamp}.txt`;
    const savePath = path.join(process.cwd(), 'transcriptions', fileName);

    console.log('transcribe-file save path =', savePath);
    
    // Ensure transcriptions directory exists
    await fs.mkdir(path.dirname(savePath), { recursive: true });
    await fs.writeFile(savePath, transcription);
    
    return {
      transcription,
      savedPath: savePath,
      fileName
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
    
    for (const file of files) {
      if (file.endsWith('.txt')) {
        const filePath = path.join(transcriptionsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        transcriptions.push({
          fileName: file,
          content,
          createdAt: stats.birthtime,
          size: stats.size
        });
      }
    }
    
    return transcriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    return [];
  }
}); 