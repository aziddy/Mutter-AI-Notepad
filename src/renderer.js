// Application State
let currentTranscription = '';
let currentJsonData = null;
// API key no longer needed with local model

// Audio Player State
let currentAudioFile = null;
let srtEntries = [];
let isPlaying = false;
let currentPlayingEntry = null;
let audioSyncEnabled = true;

// DOM Elements
const elements = {
    selectFileBtn: document.getElementById('selectFileBtn'),
    transcribeBtn: document.getElementById('transcribeBtn'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    transcriptionNameInput: document.getElementById('transcriptionNameInput'),
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
    metadataAudioSource: document.getElementById('metadataAudioSource'),
    textTab: document.getElementById('textTab'),
    srtTab: document.getElementById('srtTab'),
    textView: document.getElementById('textView'),
    srtView: document.getElementById('srtView'),
    transcriptionSrt: document.getElementById('transcriptionSrt'),
    
    // Audio Player Elements
    audioPlayerSection: document.getElementById('audioPlayerSection'),
    audioPlayer: document.getElementById('audioPlayer'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    currentTime: document.getElementById('currentTime'),
    totalTime: document.getElementById('totalTime'),
    progressBar: document.getElementById('progressBar'),
    progressSlider: document.getElementById('progressSlider'),
    muteBtn: document.getElementById('muteBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    
    // AI Features
    // API key elements removed - no longer needed
    generateSummaryBtn: document.getElementById('generateSummaryBtn'),
    generateInsightsBtn: document.getElementById('generateInsightsBtn'),
    questionInput: document.getElementById('questionInput'),
    askQuestionBtn: document.getElementById('askQuestionBtn'),
    aiResults: document.getElementById('aiResults'),
    aiResultsTitle: document.getElementById('aiResultsTitle'),
    aiResultsContent: document.getElementById('aiResultsContent'),
    
    // LLM Management elements
    initializeLLMBtn: document.getElementById('initializeLLMBtn'),
    loadContextBtn: document.getElementById('loadContextBtn'),
    clearContextBtn: document.getElementById('clearContextBtn'),
    llmStatus: document.getElementById('llmStatus'),
    contextStatus: document.getElementById('contextStatus'),
    
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
    updateLLMStatus();
});

function initializeApp() {
    // AI features are now always available with local model
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
    elements.generateSummaryBtn.addEventListener('click', () => generateSummary());
    elements.generateInsightsBtn.addEventListener('click', () => generateInsights());
    elements.askQuestionBtn.addEventListener('click', askQuestion);
    
    // LLM Management
    elements.initializeLLMBtn.addEventListener('click', initializeLLM);
    elements.loadContextBtn.addEventListener('click', loadTranscriptionIntoContext);
    elements.clearContextBtn.addEventListener('click', clearLLMContext);
    
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
    
    // API key input removed - no longer needed
    
    // Keyboard shortcuts for audio player
    document.addEventListener('keydown', (e) => {
        // Only handle shortcuts when SRT tab is active and audio is available
        if (elements.srtTab.classList.contains('active') && currentAudioFile) {
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlayPause();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    elements.audioPlayer.currentTime = Math.max(0, elements.audioPlayer.currentTime - 5);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    elements.audioPlayer.currentTime = Math.min(elements.audioPlayer.duration, elements.audioPlayer.currentTime + 5);
                    break;
            }
        }
    });
    
    // Audio Player Events
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.progressSlider.addEventListener('input', seekAudio);
    elements.volumeSlider.addEventListener('input', setVolume);
    elements.muteBtn.addEventListener('click', toggleMute);
    elements.audioPlayer.addEventListener('timeupdate', updateAudioProgress);
    elements.audioPlayer.addEventListener('loadedmetadata', onAudioLoaded);
    elements.audioPlayer.addEventListener('ended', onAudioEnded);
    elements.audioPlayer.addEventListener('play', () => {
        isPlaying = true;
        updatePlayPauseButton();
    });
    elements.audioPlayer.addEventListener('pause', () => {
        isPlaying = false;
        updatePlayPauseButton();
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
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    elements.fileName.textContent = fileName;
    elements.transcriptionNameInput.value = baseName; // Set default name
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
        
        // Get custom name from input
        const customName = elements.transcriptionNameInput.value.trim();
        
        // Update progress text
        setTimeout(() => updateProgress('Converting audio format...'), 1000);
        setTimeout(() => updateProgress('Loading Whisper model...'), 3000);
        setTimeout(() => updateProgress('Transcribing audio...'), 5000);
        
        const result = await window.electronAPI.transcribeFile(filePath, customName);
        
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
    
    // Reset audio player for new transcription
    resetAudioPlayer();
    
    currentTranscription = result.transcription;
    currentJsonData = result.jsonData;
    
    // Display metadata if available
    if (result.jsonData && result.jsonData.metadata) {
        displayMetadata(result.jsonData);
    } else {
        elements.transcriptionMetadata.classList.add('hidden');
    }
    
    // Update results header with custom name if available
    const customName = result.jsonData?.metadata?.customName;
    if (customName) {
        const resultsHeader = document.querySelector('.results-header h2');
        if (resultsHeader) {
            resultsHeader.textContent = `Transcription: ${customName}`;
        }
    }
    
    // Display transcription text
    elements.transcriptionText.textContent = result.transcription;
    
    // Display SRT entries if available
    if (result.srt && result.srt.length > 0) {
        srtEntries = parseSrt(result.srt);
        displaySrtEntries(srtEntries);
        elements.srtTab.disabled = false;
        elements.srtTab.classList.remove('disabled');
        
        // Initialize audio player if audio source file is available
        if (result.jsonData?.metadata?.audioSourceFile) {
            initializeAudioPlayer(result.jsonData.metadata.audioSourceFile, srtEntries);
        }
    } else {
        elements.srtTab.disabled = true;
        elements.srtTab.classList.add('disabled');
        elements.audioPlayerSection.classList.add('hidden');
    }
    
    elements.resultsSection.classList.remove('hidden');
    elements.transcribeBtn.disabled = false;
    
    // Always enable AI features since we're using local model
    enableAIFeatures();
    
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
    
    // Audio source file
    if (jsonData.metadata.audioSourceFile) {
        const audioFileName = jsonData.metadata.audioSourceFile.split(/[\\/]/).pop();
        elements.metadataAudioSource.textContent = `Audio: ${audioFileName}`;
        elements.metadataAudioSource.title = jsonData.metadata.audioSourceFile;
    } else {
        elements.metadataAudioSource.textContent = 'Audio: --';
    }
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
        // Hide audio player when switching to text view
        elements.audioPlayerSection.classList.add('hidden');
    } else if (tabName === 'srt') {
        elements.srtView.classList.add('active');
        // Show audio player if available
        if (currentAudioFile && srtEntries.length > 0) {
            elements.audioPlayerSection.classList.remove('hidden');
        }
    }
}

// saveApiKey function removed - no longer needed with local model

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
    if (!currentTranscription) return;
    
    try {
        elements.generateSummaryBtn.disabled = true;
        elements.generateSummaryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        // Show AI results container immediately with empty content
        showAIResults('Summary', '');
        let streamedContent = '';
        let isStreaming = true;
        
        // Add cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-stream-btn';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        elements.aiResults.appendChild(cancelBtn);
        
        // Check if we should use loaded context or pass transcription
        const useContext = await isContextLoaded();
        const transcriptionToPass = useContext ? null : currentTranscription;
        
        const cleanup = window.electronAPI.generateSummaryStream(
            transcriptionToPass,
            // onChunk
            (chunk) => {
                if (!isStreaming) return;
                streamedContent += chunk;
                // Update the content in real-time with streaming indicator
                const contentWithIndicator = streamedContent + '<span class="streaming-indicator">▋</span>';
                elements.aiResultsContent.innerHTML = window.marked.parse(contentWithIndicator || '');
                // Auto-scroll to bottom as content grows
                elements.aiResults.scrollTop = elements.aiResults.scrollHeight;
            },
            // onComplete
            (result) => {
                isStreaming = false;
                // Remove cancel button
                const cancelButton = elements.aiResults.querySelector('.cancel-stream-btn');
                if (cancelButton) cancelButton.remove();
                // Final update with complete result (no indicator)
                showAIResults('Summary', result);
                elements.generateSummaryBtn.disabled = false;
                elements.generateSummaryBtn.innerHTML = '<i class="fas fa-list"></i> Generate Summary';
            },
            // onError
            (error) => {
                isStreaming = false;
                // Remove cancel button
                const cancelButton = elements.aiResults.querySelector('.cancel-stream-btn');
                if (cancelButton) cancelButton.remove();
                showToast('Failed to generate summary: ' + error, 'error');
                elements.generateSummaryBtn.disabled = false;
                elements.generateSummaryBtn.innerHTML = '<i class="fas fa-list"></i> Generate Summary';
            }
        );
        
        // Cancel button functionality
        cancelBtn.addEventListener('click', () => {
            isStreaming = false;
            cleanup();
            cancelBtn.remove();
            elements.generateSummaryBtn.disabled = false;
            elements.generateSummaryBtn.innerHTML = '<i class="fas fa-list"></i> Generate Summary';
            showToast('Summary generation cancelled', 'info');
        });
        
    } catch (error) {
        showToast('Failed to generate summary: ' + error.message, 'error');
        elements.generateSummaryBtn.disabled = false;
        elements.generateSummaryBtn.innerHTML = '<i class="fas fa-list"></i> Generate Summary';
    }
}

async function generateInsights() {
    if (!currentTranscription) return;
    
    try {
        elements.generateInsightsBtn.disabled = true;
        elements.generateInsightsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        
        // Show AI results container immediately with empty content
        showAIResults('Insights & Analysis', '');
        let streamedContent = '';
        let isStreaming = true;
        
        // Add cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-stream-btn';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        elements.aiResults.appendChild(cancelBtn);
        
        // Check if we should use loaded context or pass transcription
        const useContext = await isContextLoaded();
        const transcriptionToPass = useContext ? null : currentTranscription;
        
        const cleanup = window.electronAPI.generateInsightsStream(
            transcriptionToPass,
            // onChunk
            (chunk) => {
                if (!isStreaming) return;
                streamedContent += chunk;
                // Update the content in real-time with streaming indicator
                const contentWithIndicator = streamedContent + '<span class="streaming-indicator">▋</span>';
                elements.aiResultsContent.innerHTML = window.marked.parse(contentWithIndicator || '');
                // Auto-scroll to bottom as content grows
                elements.aiResults.scrollTop = elements.aiResults.scrollHeight;
            },
            // onComplete
            (result) => {
                isStreaming = false;
                // Remove cancel button
                const cancelButton = elements.aiResults.querySelector('.cancel-stream-btn');
                if (cancelButton) cancelButton.remove();
                // Final update with complete result (no indicator)
                showAIResults('Insights & Analysis', result);
                elements.generateInsightsBtn.disabled = false;
                elements.generateInsightsBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Generate Insights';
            },
            // onError
            (error) => {
                isStreaming = false;
                // Remove cancel button
                const cancelButton = elements.aiResults.querySelector('.cancel-stream-btn');
                if (cancelButton) cancelButton.remove();
                showToast('Failed to generate insights: ' + error, 'error');
                elements.generateInsightsBtn.disabled = false;
                elements.generateInsightsBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Generate Insights';
            }
        );
        
        // Cancel button functionality
        cancelBtn.addEventListener('click', () => {
            isStreaming = false;
            cleanup();
            cancelBtn.remove();
            elements.generateInsightsBtn.disabled = false;
            elements.generateInsightsBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Generate Insights';
            showToast('Insights generation cancelled', 'info');
        });
        
    } catch (error) {
        showToast('Failed to generate insights: ' + error.message, 'error');
        elements.generateInsightsBtn.disabled = false;
        elements.generateInsightsBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Generate Insights';
    }
}

async function askQuestion() {
    const question = elements.questionInput.value.trim();
    if (!currentTranscription || !question) return;
    
    try {
        elements.askQuestionBtn.disabled = true;
        elements.askQuestionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Asking...';
        
        // Show AI results container immediately with empty content
        showAIResults(`Q: ${question}`, '');
        let streamedContent = '';
        let isStreaming = true;
        
        // Add cancel button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'cancel-stream-btn';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
        elements.aiResults.appendChild(cancelBtn);
        
        // Check if we should use loaded context or pass transcription
        const useContext = await isContextLoaded();
        const transcriptionToPass = useContext ? null : currentTranscription;
        
        const cleanup = window.electronAPI.askQuestionStream(
            transcriptionToPass,
            question,
            // onChunk
            (chunk) => {
                if (!isStreaming) return;
                streamedContent += chunk;
                // Update the content in real-time with streaming indicator
                const contentWithIndicator = streamedContent + '<span class="streaming-indicator">▋</span>';
                elements.aiResultsContent.innerHTML = window.marked.parse(contentWithIndicator || '');
                // Auto-scroll to bottom as content grows
                elements.aiResults.scrollTop = elements.aiResults.scrollHeight;
            },
            // onComplete
            (result) => {
                isStreaming = false;
                // Remove cancel button
                const cancelButton = elements.aiResults.querySelector('.cancel-stream-btn');
                if (cancelButton) cancelButton.remove();
                // Final update with complete result (no indicator)
                showAIResults(`Q: ${question}`, result);
                elements.questionInput.value = '';
                elements.askQuestionBtn.disabled = false;
                elements.askQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
            },
            // onError
            (error) => {
                isStreaming = false;
                // Remove cancel button
                const cancelButton = elements.aiResults.querySelector('.cancel-stream-btn');
                if (cancelButton) cancelButton.remove();
                showToast('Failed to answer question: ' + error, 'error');
                elements.askQuestionBtn.disabled = false;
                elements.askQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
            }
        );
        
        // Cancel button functionality
        cancelBtn.addEventListener('click', () => {
            isStreaming = false;
            cleanup();
            cancelBtn.remove();
            elements.askQuestionBtn.disabled = false;
            elements.askQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
            showToast('Question cancelled', 'info');
        });
        
    } catch (error) {
        showToast('Failed to answer question: ' + error.message, 'error');
        elements.askQuestionBtn.disabled = false;
        elements.askQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
    }
}

function showAIResults(title, content) {
    elements.aiResultsTitle.textContent = title;
    elements.aiResultsContent.innerHTML = window.marked.parse(content || '');
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
        const audioIndicator = transcription.jsonData?.metadata?.audioSourceFile ? 
            '<span class="audio-indicator" title="Has audio source file"><i class="fas fa-music"></i></span>' : '';
        
        // Display custom name if available, otherwise show folder name
        const displayName = transcription.customName || transcription.fileName;
        
        item.innerHTML = `
            <div class="transcription-item-header">
                <div class="transcription-name-section">
                    <h4 class="transcription-name" title="${displayName}">${displayName}</h4>
                    <button class="rename-btn" title="Rename transcription">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
                <div class="indicators">
                    ${jsonIndicator}
                    ${srtIndicator}
                    ${audioIndicator}
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
        
        // Add click handler for the main item
        item.addEventListener('click', (e) => {
            // Don't trigger if clicking on rename button
            if (!e.target.closest('.rename-btn')) {
                loadTranscription(transcription);
            }
        });
        
        // Add click handler for rename button
        const renameBtn = item.querySelector('.rename-btn');
        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showRenameDialog(transcription);
        });
        
        elements.transcriptionsList.appendChild(item);
    });
}

function loadTranscription(transcription) {
    hideWelcomeScreen();
    
    // Reset audio player for loaded transcription
    resetAudioPlayer();
    
    currentTranscription = transcription.content;
    currentJsonData = transcription.jsonData;
    
    // Display metadata if available
    if (transcription.jsonData && transcription.jsonData.metadata) {
        displayMetadata(transcription.jsonData);
    } else {
        elements.transcriptionMetadata.classList.add('hidden');
    }
    
    // Update results header with custom name if available
    const customName = transcription.customName;
    if (customName) {
        const resultsHeader = document.querySelector('.results-header h2');
        if (resultsHeader) {
            resultsHeader.textContent = `Transcription: ${customName}`;
        }
    } else {
        const resultsHeader = document.querySelector('.results-header h2');
        if (resultsHeader) {
            resultsHeader.textContent = 'Transcription Results';
        }
    }
    
    // Display transcription text
    elements.transcriptionText.textContent = transcription.content;
    
    // Display SRT entries if available
    if (transcription.srtData && transcription.srtData.length > 0) {
        srtEntries = parseSrt(transcription.srtData);
        displaySrtEntries(srtEntries);
        elements.srtTab.disabled = false;
        elements.srtTab.classList.remove('disabled');
        
        // Initialize audio player if audio source file is available
        if (transcription.jsonData?.metadata?.audioSourceFile) {
            initializeAudioPlayer(transcription.jsonData.metadata.audioSourceFile, srtEntries);
        }
    } else {
        elements.srtTab.disabled = true;
        elements.srtTab.classList.add('disabled');
        elements.audioPlayerSection.classList.add('hidden');
    }
    
    elements.resultsSection.classList.remove('hidden');
    elements.fileInfo.classList.add('hidden');
    
    // Always enable AI features since we're using local model
    enableAIFeatures();
    
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
        
        // Add click handler
        entryElement.addEventListener('click', () => onSrtEntryClick(entry));
        
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

// Audio Player Functions
function resetAudioPlayer() {
    if (elements.audioPlayer) {
        elements.audioPlayer.pause();
        elements.audioPlayer.currentTime = 0;
    }
    currentAudioFile = null;
    srtEntries = [];
    isPlaying = false;
    currentPlayingEntry = null;
    elements.audioPlayerSection.classList.add('hidden');
    clearPlayingEntry();
}

function initializeAudioPlayer(audioFilePath, entries) {
    currentAudioFile = audioFilePath;
    srtEntries = entries;
    
    // Set audio source
    elements.audioPlayer.src = `file://${audioFilePath}`;
    
    // Show audio player section
    elements.audioPlayerSection.classList.remove('hidden');
    
    // Reset player state
    isPlaying = false;
    currentPlayingEntry = null;
    updatePlayPauseButton();
    
    // Show loading state
    elements.playPauseBtn.disabled = true;
    elements.playPauseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    elements.playPauseBtn.title = 'Loading...';
}

function togglePlayPause() {
    if (!currentAudioFile) return;
    
    if (isPlaying) {
        elements.audioPlayer.pause();
    } else {
        elements.audioPlayer.play();
    }
}

function updatePlayPauseButton() {
    const icon = elements.playPauseBtn.querySelector('i');
    if (isPlaying) {
        icon.className = 'fas fa-pause';
        elements.playPauseBtn.title = 'Pause';
    } else {
        icon.className = 'fas fa-play';
        elements.playPauseBtn.title = 'Play';
    }
}

function seekAudio() {
    if (!currentAudioFile) return;
    
    const seekTime = (elements.progressSlider.value / 100) * elements.audioPlayer.duration;
    elements.audioPlayer.currentTime = seekTime;
    
    // Temporarily disable sync to prevent jumping
    audioSyncEnabled = false;
    setTimeout(() => {
        audioSyncEnabled = true;
    }, 100);
}

function setVolume() {
    const volume = elements.volumeSlider.value / 100;
    elements.audioPlayer.volume = volume;
    
    // Update mute button icon
    const icon = elements.muteBtn.querySelector('i');
    if (volume === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (volume < 0.5) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

function toggleMute() {
    if (elements.audioPlayer.volume > 0) {
        elements.audioPlayer.volume = 0;
        elements.volumeSlider.value = 0;
    } else {
        elements.audioPlayer.volume = 1;
        elements.volumeSlider.value = 100;
    }
    setVolume();
}

function updateAudioProgress() {
    if (!currentAudioFile || !audioSyncEnabled) return;
    
    const currentTime = elements.audioPlayer.currentTime;
    const duration = elements.audioPlayer.duration;
    
    // Update time displays
    elements.currentTime.textContent = formatTime(currentTime);
    elements.totalTime.textContent = formatTime(duration);
    
    // Update progress bar
    const progress = (currentTime / duration) * 100;
    elements.progressBar.style.width = `${progress}%`;
    elements.progressSlider.value = progress;
    
    // Sync with SRT entries
    syncWithSrtEntries(currentTime);
}

function onAudioLoaded() {
    elements.totalTime.textContent = formatTime(elements.audioPlayer.duration);
    setVolume(); // Initialize volume
    
    // Enable play button and show correct icon
    elements.playPauseBtn.disabled = false;
    elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    elements.playPauseBtn.title = 'Play';
}

function onAudioEnded() {
    isPlaying = false;
    updatePlayPauseButton();
    clearPlayingEntry();
}

function syncWithSrtEntries(currentTime) {
    if (!srtEntries.length) return;
    
    // Find the current SRT entry
    let currentEntry = null;
    for (let i = 0; i < srtEntries.length; i++) {
        const entry = srtEntries[i];
        if (currentTime >= entry.startTime && currentTime <= entry.endTime) {
            currentEntry = entry;
            break;
        }
    }
    
    // Update playing entry
    if (currentEntry !== currentPlayingEntry) {
        clearPlayingEntry();
        if (currentEntry) {
            highlightPlayingEntry(currentEntry);
        }
    }
}

function highlightPlayingEntry(entry) {
    currentPlayingEntry = entry;
    
    // Find and highlight the corresponding DOM element
    const entryElements = elements.transcriptionSrt.querySelectorAll('.srt-entry');
    entryElements.forEach((element, index) => {
        if (srtEntries[index] === entry) {
            element.classList.add('playing');
            
            // Update the time display to show current position
            const timeElement = element.querySelector('.srt-entry-time');
            if (timeElement) {
                const currentTime = elements.audioPlayer.currentTime;
                const startTime = formatTime(entry.startTime);
                const endTime = formatTime(entry.endTime);
                const currentTimeStr = formatTime(currentTime);
                timeElement.textContent = `${startTime} - ${endTime} (${currentTimeStr})`;
            }
            
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Reset other entries to normal display
            element.classList.remove('playing');
            const timeElement = element.querySelector('.srt-entry-time');
            if (timeElement) {
                const startTime = formatTime(srtEntries[index].startTime);
                const endTime = formatTime(srtEntries[index].endTime);
                timeElement.textContent = `${startTime} - ${endTime}`;
            }
        }
    });
}

function clearPlayingEntry() {
    if (currentPlayingEntry) {
        const entryElements = elements.transcriptionSrt.querySelectorAll('.srt-entry');
        entryElements.forEach((element, index) => {
            element.classList.remove('playing');
            // Reset time display to normal format
            const timeElement = element.querySelector('.srt-entry-time');
            if (timeElement && srtEntries[index]) {
                const startTime = formatTime(srtEntries[index].startTime);
                const endTime = formatTime(srtEntries[index].endTime);
                timeElement.textContent = `${startTime} - ${endTime}`;
            }
        });
        currentPlayingEntry = null;
    }
}

// SRT Entry Click Handler
function onSrtEntryClick(entry) {
    if (!currentAudioFile) return;
    
    // Seek to the start time of the entry
    elements.audioPlayer.currentTime = entry.startTime;
    
    // Temporarily disable sync to prevent jumping
    audioSyncEnabled = false;
    setTimeout(() => {
        audioSyncEnabled = true;
    }, 100);
    
    // Highlight the clicked entry
    clearPlayingEntry();
    highlightPlayingEntry(entry);
}

// LLM Management Functions
async function initializeLLM() {
    try {
        elements.initializeLLMBtn.disabled = true;
        elements.initializeLLMBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Model...';
        updateLLMStatusIndicator('loading', 'Loading...');
        
        const result = await window.electronAPI.initializeLLM();
        
        if (result.success) {
            showToast(result.message, 'success');
            updateLLMStatus();
            elements.initializeLLMBtn.innerHTML = '<i class="fas fa-check"></i> Model Loaded';
            elements.initializeLLMBtn.disabled = false;
        } else {
            showToast(result.message, 'error');
            elements.initializeLLMBtn.disabled = false;
            elements.initializeLLMBtn.innerHTML = '<i class="fas fa-power-off"></i> Load LLM Model';
            updateLLMStatusIndicator('error', 'Failed');
        }
    } catch (error) {
        showToast('Failed to initialize LLM: ' + error.message, 'error');
        elements.initializeLLMBtn.disabled = false;
        elements.initializeLLMBtn.innerHTML = '<i class="fas fa-power-off"></i> Load LLM Model';
        updateLLMStatusIndicator('error', 'Failed');
    }
}

async function loadTranscriptionIntoContext() {
    if (!currentTranscription) {
        showToast('No transcription available. Please transcribe a file first.', 'error');
        return;
    }
    
    try {
        elements.loadContextBtn.disabled = true;
        elements.loadContextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        updateContextStatusIndicator('loading', 'Loading...');
        
        const result = await window.electronAPI.loadTranscriptionIntoContext(currentTranscription);
        
        if (result.success) {
            showToast(result.message, 'success');
            updateLLMStatus();
            elements.loadContextBtn.innerHTML = '<i class="fas fa-check"></i> Context Loaded';
            
            // Show a brief acknowledgment from the AI
            if (result.acknowledgment) {
                showAIResults('LLM Context Loaded', result.acknowledgment);
            }
        } else {
            showToast('Failed to load transcription into context', 'error');
            updateContextStatusIndicator('error', 'Failed');
        }
    } catch (error) {
        showToast('Failed to load transcription: ' + error.message, 'error');
        updateContextStatusIndicator('error', 'Failed');
    } finally {
        elements.loadContextBtn.disabled = false;
        if (!elements.loadContextBtn.innerHTML.includes('Context Loaded')) {
            elements.loadContextBtn.innerHTML = '<i class="fas fa-upload"></i> Load Transcription into Context';
        }
    }
}

async function clearLLMContext() {
    try {
        elements.clearContextBtn.disabled = true;
        elements.clearContextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Clearing...';
        
        const result = await window.electronAPI.clearLLMContext();
        
        if (result.success) {
            showToast(result.message, 'success');
            updateLLMStatus();
            elements.loadContextBtn.innerHTML = '<i class="fas fa-upload"></i> Load Transcription into Context';
            
            // Hide AI results when context is cleared
            elements.aiResults.classList.add('hidden');
        } else {
            showToast('Failed to clear context', 'error');
        }
    } catch (error) {
        showToast('Failed to clear context: ' + error.message, 'error');
    } finally {
        elements.clearContextBtn.disabled = false;
        elements.clearContextBtn.innerHTML = '<i class="fas fa-trash"></i> Clear Context';
    }
}

async function updateLLMStatus() {
    try {
        const status = await window.electronAPI.getLLMStatus();
        
        // Update LLM status
        if (status.isInitialized) {
            updateLLMStatusIndicator('ready', 'Model Ready');
            elements.loadContextBtn.disabled = false;
        } else {
            updateLLMStatusIndicator('', 'Not Loaded');
            elements.loadContextBtn.disabled = true;
        }
        
        // Update context status
        if (status.hasTranscriptionLoaded) {
            updateContextStatusIndicator('ready', 'Context Loaded');
            elements.clearContextBtn.disabled = false;
            // Update the load context button to show loaded state
            elements.loadContextBtn.innerHTML = '<i class="fas fa-check"></i> Context Loaded';
        } else {
            updateContextStatusIndicator('', 'No Context');
            elements.clearContextBtn.disabled = true;
            elements.loadContextBtn.innerHTML = '<i class="fas fa-upload"></i> Load Transcription into Context';
        }
        
        // Enable/disable AI features based on status
        const aiActionsEnabled = status.isInitialized;
        
        // Summary and Insights now REQUIRE transcription to be loaded into context first
        const summaryInsightsEnabled = status.isInitialized && status.hasTranscriptionLoaded;
        elements.generateSummaryBtn.disabled = !summaryInsightsEnabled;
        elements.generateInsightsBtn.disabled = !summaryInsightsEnabled;
        
        // Questions can be asked anytime the model is loaded (general questions or transcription-specific)
        elements.askQuestionBtn.disabled = !aiActionsEnabled;
        elements.questionInput.disabled = !aiActionsEnabled;
        
    } catch (error) {
        console.error('Failed to get LLM status:', error);
    }
}

function updateLLMStatusIndicator(status, text) {
    elements.llmStatus.textContent = text;
    elements.llmStatus.className = 'status-indicator';
    if (status) {
        elements.llmStatus.classList.add(status);
    }
}

function updateContextStatusIndicator(status, text) {
    elements.contextStatus.textContent = text;
    elements.contextStatus.className = 'status-indicator';
    if (status) {
        elements.contextStatus.classList.add(status);
    }
}

async function isContextLoaded() {
    try {
        const status = await window.electronAPI.getLLMStatus();
        return status.hasTranscriptionLoaded;
    } catch (error) {
        console.error('Failed to check context status:', error);
        return false;
    }
}

// Add rename dialog functionality
function showRenameDialog(transcription) {
    const currentName = transcription.customName || transcription.fileName;
    
    // Create modal dialog
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Rename Transcription</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <label for="transcriptionName">Name:</label>
                <input type="text" id="transcriptionName" value="${currentName}" placeholder="Enter transcription name">
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" id="cancelRename">Cancel</button>
                <button class="btn btn-primary" id="saveRename">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus on input
    const nameInput = modal.querySelector('#transcriptionName');
    nameInput.focus();
    nameInput.select();
    
    // Event listeners
    const closeModal = () => {
        document.body.removeChild(modal);
    };
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#cancelRename').addEventListener('click', closeModal);
    
    modal.querySelector('#saveRename').addEventListener('click', async () => {
        const newName = nameInput.value.trim();
        if (!newName) {
            showToast('Please enter a name', 'error');
            return;
        }
        
        try {
            await window.electronAPI.updateTranscriptionName(transcription.fileName, newName);
            showToast('Transcription renamed successfully', 'success');
            closeModal();
            loadTranscriptions(); // Refresh the list
        } catch (error) {
            showToast('Failed to rename transcription: ' + error.message, 'error');
        }
    });
    
    // Close on escape key
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        } else if (e.key === 'Enter') {
            modal.querySelector('#saveRename').click();
        }
    });
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}