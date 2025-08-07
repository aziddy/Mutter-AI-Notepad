const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { transcribeAudio } = require('./transcription');
const { 
  generateSummary, 
  askQuestion, 
  generateInsights, 
  generateSummaryStream, 
  askQuestionStream, 
  generateInsightsStream,
  initializeLLM,
  loadTranscriptionIntoContext,
  clearLLMContext,
  getLLMStatus,
  getAvailableModels,
  getExternalAPIModels,
  testConnection,
  updateLLMConfiguration
} = require('./llm');

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

  // Load from Vite dev server in development or from built files in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.argv.includes('--dev') || isDevelopment) {
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

ipcMain.handle('transcribe-file', async (event, filePath, customName = null) => {
  console.log('transcribe-file given file path =', filePath, 'custom name =', customName);
  try {
    // Create transcription folder first
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFileName = `transcription-${timestamp}`;
    const saveDir = path.join(process.cwd(), 'transcriptions');
    
    console.log('transcribe-file save dir =', saveDir);
    
    // Ensure transcriptions directory exists
    await fs.mkdir(saveDir, { recursive: true });
    
    // Create individual folder for this transcription
    const transcriptionFolder = path.join(saveDir, baseFileName);
    await fs.mkdir(transcriptionFolder, { recursive: true });
    
    // Pass the transcription folder to the transcribe function
    const result = await transcribeAudio(filePath, transcriptionFolder);
    
    // Save transcription to text, JSON, and SRT files
    console.log('transcribe-file generating save paths');
    const textFileName = `${baseFileName}.txt`;
    const jsonFileName = `${baseFileName}.json`;
    const srtFileName = `${baseFileName}.srt`;
    
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
        wordCount: result.text.split(/\s+/).length,
        audioSourceFile: path.extname(filePath).toLowerCase() === '.wav' ? 
          path.join(transcriptionFolder, `${path.basename(filePath, '.wav')}_audio_source.wav`) : 
          path.join(transcriptionFolder, `${path.basename(filePath, path.extname(filePath))}_audio_source.wav`),
        customName: customName || path.basename(filePath, path.extname(filePath)) // Use custom name or original filename as default
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

// LLM Management handlers
ipcMain.handle('initialize-llm', async (event) => {
  try {
    return await initializeLLM();
  } catch (error) {
    throw new Error(`LLM initialization failed: ${error.message}`);
  }
});

ipcMain.handle('load-transcription-into-context', async (event, transcription) => {
  try {
    return await loadTranscriptionIntoContext(transcription);
  } catch (error) {
    throw new Error(`Failed to load transcription into context: ${error.message}`);
  }
});

ipcMain.handle('clear-llm-context', async (event) => {
  try {
    return await clearLLMContext();
  } catch (error) {
    throw new Error(`Failed to clear LLM context: ${error.message}`);
  }
});

ipcMain.handle('get-llm-status', async (event) => {
  try {
    return getLLMStatus();
  } catch (error) {
    throw new Error(`Failed to get LLM status: ${error.message}`);
  }
});

// New LLM Configuration handlers
ipcMain.handle('get-available-models', async (event) => {
  try {
    return await getAvailableModels();
  } catch (error) {
    throw new Error(`Failed to get available models: ${error.message}`);
  }
});

ipcMain.handle('get-external-api-models', async (event, apiEndpoint, apiKey) => {
  try {
    return await getExternalAPIModels(apiEndpoint, apiKey);
  } catch (error) {
    throw new Error(`Failed to get external API models: ${error.message}`);
  }
});

ipcMain.handle('test-llm-connection', async (event) => {
  try {
    return await testConnection();
  } catch (error) {
    throw new Error(`Failed to test connection: ${error.message}`);
  }
});

ipcMain.handle('update-llm-configuration', async (event, config) => {
  try {
    return await updateLLMConfiguration(config);
  } catch (error) {
    throw new Error(`Failed to update LLM configuration: ${error.message}`);
  }
});

// Existing non-streaming handlers
ipcMain.handle('generate-summary', async (event, transcription) => {
  try {
    return await generateSummary(transcription);
  } catch (error) {
    throw new Error(`Summary generation failed: ${error.message}`);
  }
});

ipcMain.handle('ask-question', async (event, transcription, question) => {
  try {
    return await askQuestion(transcription, question);
  } catch (error) {
    throw new Error(`Question answering failed: ${error.message}`);
  }
});

ipcMain.handle('generate-insights', async (event, transcription) => {
  try {
    return await generateInsights(transcription);
  } catch (error) {
    throw new Error(`Insights generation failed: ${error.message}`);
  }
});

// New streaming handlers
ipcMain.handle('generate-summary-stream', async (event, transcription, streamId) => {
  try {
    const onChunk = (chunk) => {
      event.sender.send(`llm-stream-chunk-${streamId}`, chunk);
    };
    
    const result = await generateSummaryStream(transcription, onChunk);
    event.sender.send(`llm-stream-complete-${streamId}`, result);
    return result;
  } catch (error) {
    event.sender.send(`llm-stream-error-${streamId}`, error.message);
    throw new Error(`Summary generation failed: ${error.message}`);
  }
});

ipcMain.handle('ask-question-stream', async (event, transcription, question, streamId) => {
  try {
    const onChunk = (chunk) => {
      event.sender.send(`llm-stream-chunk-${streamId}`, chunk);
    };
    
    const result = await askQuestionStream(transcription, question, onChunk);
    event.sender.send(`llm-stream-complete-${streamId}`, result);
    return result;
  } catch (error) {
    event.sender.send(`llm-stream-error-${streamId}`, error.message);
    throw new Error(`Question answering failed: ${error.message}`);
  }
});

ipcMain.handle('generate-insights-stream', async (event, transcription, streamId) => {
  try {
    const onChunk = (chunk) => {
      event.sender.send(`llm-stream-chunk-${streamId}`, chunk);
    };
    
    const result = await generateInsightsStream(transcription, onChunk);
    event.sender.send(`llm-stream-complete-${streamId}`, result);
    return result;
  } catch (error) {
    event.sender.send(`llm-stream-error-${streamId}`, error.message);
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
          // Get custom name from metadata if available
          const customName = jsonData?.metadata?.customName || null;
          
          transcriptions.push({
            fileName: folder,
            customName: customName,
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

// Add handler for updating transcription name
ipcMain.handle('update-transcription-name', async (event, folderName, newName) => {
  try {
    const transcriptionsDir = path.join(process.cwd(), 'transcriptions');
    const folderPath = path.join(transcriptionsDir, folderName);
    
    // Check if folder exists
    if (!fs.existsSync(folderPath)) {
      throw new Error('Transcription folder not found');
    }
    
    // Find and update the JSON file
    const files = await fs.readdir(folderPath);
    let jsonFile = null;
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        jsonFile = file;
        break;
      }
    }
    
    if (!jsonFile) {
      throw new Error('No JSON metadata file found');
    }
    
    const jsonPath = path.join(folderPath, jsonFile);
    const jsonContent = await fs.readFile(jsonPath, 'utf-8');
    const jsonData = JSON.parse(jsonContent);
    
    // Update the custom name in metadata
    if (!jsonData.metadata) {
      jsonData.metadata = {};
    }
    jsonData.metadata.customName = newName;
    
    // Save the updated JSON file
    await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));
    
    return { success: true, message: 'Transcription name updated successfully' };
  } catch (error) {
    console.error('Error updating transcription name:', error);
    throw new Error(`Failed to update transcription name: ${error.message}`);
  }
}); 