// Application State
let currentTranscription = '';
let currentJsonData = null;
let currentApiKey = localStorage.getItem('openai_api_key') || '';

// DOM Elements
const elements = {
    selectFileBtn: document.getElementById('selectFileBtn'),
    transcribeBtn: document.getElementById('transcribeBtn'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    progressSection: document.getElementById('progressSection'),
    progressText: document.getElementById('progressText'),
    resultsSection: document.getElementById('resultsSection'),
    transcriptionText: document.getElementById('transcriptionText'),
    welcomeScreen: document.getElementById('welcomeScreen'),
    transcriptionsList: document.getElementById('transcriptionsList'),
    
    // New UI Components
    transcriptionMetadata: document.getElementById('transcriptionMetadata'),
    metadataDuration: document.getElementById('metadataDuration'),
    metadataLanguage: document.getElementById('metadataLanguage'),
    metadataWordCount: document.getElementById('metadataWordCount'),
    metadataDate: document.getElementById('metadataDate'),
    textTab: document.getElementById('textTab'),
    srtTab: document.getElementById('srtTab'),
    textView: document.getElementById('textView'),
    srtView: document.getElementById('srtView'),
    transcriptionSrt: document.getElementById('transcriptionSrt'),
    
    // AI Features
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    generateSummaryBtn: document.getElementById('generateSummaryBtn'),
    generateInsightsBtn: document.getElementById('generateInsightsBtn'),
    questionInput: document.getElementById('questionInput'),
    askQuestionBtn: document.getElementById('askQuestionBtn'),
    aiResults: document.getElementById('aiResults'),
    aiResultsTitle: document.getElementById('aiResultsTitle'),
    aiResultsContent: document.getElementById('aiResultsContent'),
    
    // Actions
    copyBtn: document.getElementById('copyBtn'),
    saveBtn: document.getElementById('saveBtn'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    toastClose: document.getElementById('toastClose')
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadTranscriptions();
});

function initializeApp() {
    // Set API key if available
    if (currentApiKey) {
        elements.apiKeyInput.value = currentApiKey;
        enableAIFeatures();
    }
    
    showWelcomeScreen();
}

function setupEventListeners() {
    // File selection
    elements.selectFileBtn.addEventListener('click', selectFile);
    elements.transcribeBtn.addEventListener('click', startTranscription);
    
    // Tab switching
    elements.textTab.addEventListener('click', () => switchTab('text'));
    elements.srtTab.addEventListener('click', () => switchTab('srt'));
    
    // AI Features
    elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
    elements.generateSummaryBtn.addEventListener('click', () => generateSummary());
    elements.generateInsightsBtn.addEventListener('click', () => generateInsights());
    elements.askQuestionBtn.addEventListener('click', askQuestion);
    
    // Actions
    elements.copyBtn.addEventListener('click', copyTranscription);
    elements.saveBtn.addEventListener('click', saveTranscription);
    
    // Toast
    elements.toastClose.addEventListener('click', hideToast);
    
    // Enter key for question input
    elements.questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !elements.askQuestionBtn.disabled) {
            askQuestion();
        }
    });
    
    // API key input
    elements.apiKeyInput.addEventListener('input', () => {
        elements.saveApiKeyBtn.disabled = !elements.apiKeyInput.value.trim();
    });
}

async function selectFile() {
    try {
        const filePath = await window.electronAPI.selectFile();
        if (filePath) {
            showFileInfo(filePath);
        }
    } catch (error) {
        showToast('Error selecting file: ' + error.message, 'error');
    }
}

function showFileInfo(filePath) {
    hideWelcomeScreen();
    
    const fileName = filePath.split(/[\\/]/).pop();
    elements.fileName.textContent = fileName;
    elements.fileInfo.classList.remove('hidden');
    elements.transcribeBtn.disabled = false;
    elements.transcribeBtn.setAttribute('data-file-path', filePath);
}

async function startTranscription() {
    const filePath = elements.transcribeBtn.getAttribute('data-file-path');
    if (!filePath) return;
    
    try {
        showProgress('Initializing transcription...');
        elements.transcribeBtn.disabled = true;
        
        // Update progress text
        setTimeout(() => updateProgress('Converting audio format...'), 1000);
        setTimeout(() => updateProgress('Loading Whisper model...'), 3000);
        setTimeout(() => updateProgress('Transcribing audio...'), 5000);
        
        const result = await window.electronAPI.transcribeFile(filePath);
        
        currentTranscription = result.transcription;
        currentJsonData = result.jsonData;
        showTranscriptionResults(result);
        loadTranscriptions(); // Refresh the transcriptions list
        
    } catch (error) {
        hideProgress();
        showToast('Transcription failed: ' + error.message, 'error');
        elements.transcribeBtn.disabled = false;
    }
}

function showProgress(text) {
    elements.progressText.textContent = text;
    elements.fileInfo.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');
    elements.progressSection.classList.remove('hidden');
}

function updateProgress(text) {
    elements.progressText.textContent = text;
}

function hideProgress() {
    elements.progressSection.classList.add('hidden');
}

function showTranscriptionResults(result) {
    hideProgress();
    
    currentTranscription = result.transcription;
    currentJsonData = result.jsonData;
    
    // Display metadata if available
    if (result.jsonData && result.jsonData.metadata) {
        displayMetadata(result.jsonData);
    } else {
        elements.transcriptionMetadata.classList.add('hidden');
    }
    
    // Display transcription text
    elements.transcriptionText.textContent = result.transcription;
    
    // Display SRT entries if available
    if (result.srt && result.srt.length > 0) {
        const srtEntries = parseSrt(result.srt);
        displaySrtEntries(srtEntries);
        elements.srtTab.disabled = false;
        elements.srtTab.classList.remove('disabled');
    } else {
        elements.srtTab.disabled = true;
        elements.srtTab.classList.add('disabled');
    }
    
    elements.resultsSection.classList.remove('hidden');
    elements.transcribeBtn.disabled = false;
    
    // Enable AI features if API key is available
    if (currentApiKey) {
        enableAIFeatures();
    }
    
    showToast(`Transcription completed! Saved as ${result.fileName}`, 'success');
}

function displayMetadata(jsonData) {
    elements.transcriptionMetadata.classList.remove('hidden');
    
    // Duration
    if (jsonData.metadata.duration) {
        const minutes = Math.floor(jsonData.metadata.duration / 60);
        const seconds = Math.floor(jsonData.metadata.duration % 60);
        elements.metadataDuration.textContent = `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
        elements.metadataDuration.textContent = 'Duration: --';
    }
    
    // Language
    elements.metadataLanguage.textContent = `Language: ${jsonData.language || 'en'}`;
    
    // Word count
    elements.metadataWordCount.textContent = `Words: ${jsonData.metadata.wordCount || jsonData.text.split(/\s+/).length}`;
    
    // Date
    const date = new Date(jsonData.metadata.transcribedAt);
    elements.metadataDate.textContent = `Date: ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (tabName === 'text') {
        elements.textTab.classList.add('active');
    } else if (tabName === 'srt') {
        elements.srtTab.classList.add('active');
    }
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'text') {
        elements.textView.classList.add('active');
    } else if (tabName === 'srt') {
        elements.srtView.classList.add('active');
    }
}

function saveApiKey() {
    const apiKey = elements.apiKeyInput.value.trim();
    if (apiKey) {
        currentApiKey = apiKey;
        localStorage.setItem('openai_api_key', apiKey);
        enableAIFeatures();
        showToast('API key saved successfully!', 'success');
    }
}

function enableAIFeatures() {
    elements.generateSummaryBtn.disabled = !currentTranscription;
    elements.generateInsightsBtn.disabled = !currentTranscription;
    elements.questionInput.disabled = !currentTranscription;
    elements.askQuestionBtn.disabled = !currentTranscription || !elements.questionInput.value.trim();
    
    elements.questionInput.addEventListener('input', () => {
        elements.askQuestionBtn.disabled = !currentTranscription || !elements.questionInput.value.trim();
    });
}

async function generateSummary() {
    if (!currentTranscription || !currentApiKey) return;
    
    try {
        elements.generateSummaryBtn.disabled = true;
        elements.generateSummaryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        const summary = await window.electronAPI.generateSummary(currentTranscription, currentApiKey);
        
        showAIResults('Summary', summary);
        
    } catch (error) {
        showToast('Failed to generate summary: ' + error.message, 'error');
    } finally {
        elements.generateSummaryBtn.disabled = false;
        elements.generateSummaryBtn.innerHTML = '<i class="fas fa-list"></i> Generate Summary';
    }
}

async function generateInsights() {
    if (!currentTranscription || !currentApiKey) return;
    
    try {
        elements.generateInsightsBtn.disabled = true;
        elements.generateInsightsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        
        const insights = await window.electronAPI.generateInsights(currentTranscription, currentApiKey);
        
        showAIResults('Insights & Analysis', insights);
        
    } catch (error) {
        showToast('Failed to generate insights: ' + error.message, 'error');
    } finally {
        elements.generateInsightsBtn.disabled = false;
        elements.generateInsightsBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Generate Insights';
    }
}

async function askQuestion() {
    const question = elements.questionInput.value.trim();
    if (!currentTranscription || !currentApiKey || !question) return;
    
    try {
        elements.askQuestionBtn.disabled = true;
        elements.askQuestionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Asking...';
        
        const answer = await window.electronAPI.askQuestion(currentTranscription, question, currentApiKey);
        
        showAIResults(`Q: ${question}`, answer);
        elements.questionInput.value = '';
        
    } catch (error) {
        showToast('Failed to answer question: ' + error.message, 'error');
    } finally {
        elements.askQuestionBtn.disabled = false;
        elements.askQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
    }
}

function showAIResults(title, content) {
    elements.aiResultsTitle.textContent = title;
    elements.aiResultsContent.textContent = content;
    elements.aiResults.classList.remove('hidden');
    
    // Scroll to results
    elements.aiResults.scrollIntoView({ behavior: 'smooth' });
}

async function loadTranscriptions() {
    try {
        const transcriptions = await window.electronAPI.getTranscriptions();
        displayTranscriptions(transcriptions);
    } catch (error) {
        console.error('Failed to load transcriptions:', error);
    }
}

function displayTranscriptions(transcriptions) {
    elements.transcriptionsList.innerHTML = '';
    
    if (transcriptions.length === 0) {
        elements.transcriptionsList.innerHTML = '<p style="color: #9CA3AF; font-size: 0.8rem; text-align: center; padding: 20px;">No transcriptions yet</p>';
        return;
    }
    
    transcriptions.forEach(transcription => {
        const item = document.createElement('div');
        item.className = 'transcription-item';
        
        const preview = transcription.content.substring(0, 100) + (transcription.content.length > 100 ? '...' : '');
        const date = new Date(transcription.createdAt).toLocaleDateString();
        const time = new Date(transcription.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Add JSON and SRT indicators
        const jsonIndicator = transcription.hasJson ? 
            '<span class="json-indicator" title="Has detailed segments and metadata"><i class="fas fa-code"></i></span>' : '';
        const srtIndicator = transcription.hasSrt ? 
            '<span class="srt-indicator" title="Has SRT subtitle file"><i class="fas fa-closed-captioning"></i></span>' : '';
        
        item.innerHTML = `
            <div class="transcription-item-header">
                <h4>${transcription.fileName}</h4>
                <div class="indicators">
                    ${jsonIndicator}
                    ${srtIndicator}
                </div>
            </div>
            <p>${preview}</p>
            <div class="transcription-item-footer">
                <div class="date">${date} at ${time}</div>
                <div class="format-indicator">
                    ${transcription.hasJson ? 'JSON + TXT' : 'TXT only'}${transcription.hasSrt ? ' + SRT' : ''}
                </div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            loadTranscription(transcription);
        });
        
        elements.transcriptionsList.appendChild(item);
    });
}

function loadTranscription(transcription) {
    hideWelcomeScreen();
    currentTranscription = transcription.content;
    currentJsonData = transcription.jsonData;
    
    // Display metadata if available
    if (transcription.jsonData && transcription.jsonData.metadata) {
        displayMetadata(transcription.jsonData);
    } else {
        elements.transcriptionMetadata.classList.add('hidden');
    }
    
    // Display transcription text
    elements.transcriptionText.textContent = transcription.content;
    
    // Display SRT entries if available
    if (transcription.srtData && transcription.srtData.length > 0) {
        const srtEntries = parseSrt(transcription.srtData);
        displaySrtEntries(srtEntries);
        elements.srtTab.disabled = false;
        elements.srtTab.classList.remove('disabled');
    } else {
        elements.srtTab.disabled = true;
        elements.srtTab.classList.add('disabled');
    }
    
    elements.resultsSection.classList.remove('hidden');
    elements.fileInfo.classList.add('hidden');
    
    if (currentApiKey) {
        enableAIFeatures();
    }
    
    showToast('Transcription loaded', 'success');
}

function copyTranscription() {
    if (!currentTranscription) return;
    
    navigator.clipboard.writeText(currentTranscription).then(() => {
        showToast('Transcription copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy transcription', 'error');
    });
}

function saveTranscription() {
    showToast('Transcription is automatically saved!', 'info');
}

function showWelcomeScreen() {
    elements.welcomeScreen.classList.remove('hidden');
    elements.fileInfo.classList.add('hidden');
    elements.progressSection.classList.add('hidden');
    elements.resultsSection.classList.add('hidden');
}

function hideWelcomeScreen() {
    elements.welcomeScreen.classList.add('hidden');
}

function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    
    // Set toast color based on type
    switch (type) {
        case 'error':
            elements.toast.style.background = '#EF4444';
            break;
        case 'info':
            elements.toast.style.background = '#3B82F6';
            break;
        default:
            elements.toast.style.background = '#10B981';
    }
    
    elements.toast.classList.add('show');
    
    // Auto hide after 3 seconds
    setTimeout(hideToast, 3000);
}

function hideToast() {
    elements.toast.classList.remove('show');
}

// Error handling
window.addEventListener('error', (e) => {
    showToast('An unexpected error occurred', 'error');
    console.error('Renderer error:', e);
});

window.addEventListener('unhandledrejection', (e) => {
    showToast('An unexpected error occurred', 'error');
    console.error('Unhandled promise rejection:', e);
});

function parseSrt(srtContent) {
    if (!srtContent) return [];
    
    const entries = [];
    const blocks = srtContent.trim().split('\n\n');
    
    for (const block of blocks) {
        const lines = block.split('\n').filter(line => line.trim());
        if (lines.length < 3) continue;
        
        // Skip the sequence number (first line)
        const timeLine = lines[1];
        const textLines = lines.slice(2);
        
        // Parse time line (format: "00:00:00,000 --> 00:00:00,000")
        const timeMatch = timeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!timeMatch) continue;
        
        const startTime = parseFloat(timeMatch[1]) * 3600 + parseFloat(timeMatch[2]) * 60 + parseFloat(timeMatch[3]) + parseFloat(timeMatch[4]) / 1000;
        const endTime = parseFloat(timeMatch[5]) * 3600 + parseFloat(timeMatch[6]) * 60 + parseFloat(timeMatch[7]) + parseFloat(timeMatch[8]) / 1000;
        const text = textLines.join(' ').trim();
        
        entries.push({
            startTime: startTime,
            endTime: endTime,
            text: text
        });
    }
    
    return entries;
}

function displaySrtEntries(srtEntries) {
    elements.transcriptionSrt.innerHTML = '';
    
    if (srtEntries.length === 0) {
        elements.transcriptionSrt.innerHTML = '<p style="color: #9CA3AF; text-align: center; padding: 20px;">No SRT data available</p>';
        return;
    }
    
    srtEntries.forEach((entry, index) => {
        const entryElement = document.createElement('div');
        entryElement.className = 'srt-entry';
        
        const startTime = formatTime(entry.startTime);
        const endTime = formatTime(entry.endTime);
        
        entryElement.innerHTML = `
            <div class="srt-entry-header">
                <span class="srt-entry-number">#${index + 1}</span>
                <span class="srt-entry-time">${startTime} - ${endTime}</span>
            </div>
            <div class="srt-entry-text">${entry.text}</div>
        `;
        
        elements.transcriptionSrt.appendChild(entryElement);
    });
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getConfidenceClass(confidence) {
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.6) return 'confidence-medium';
    return 'confidence-low';
} 