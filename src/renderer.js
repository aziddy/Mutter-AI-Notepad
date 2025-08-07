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
    
    // Local AI Section elements
    initializeLocalBtn: document.getElementById('initializeLocalBtn'),
    loadContextBtn: document.getElementById('loadContextBtn'),
    clearContextBtn: document.getElementById('clearContextBtn'),
    localModelStatus: document.getElementById('localModelStatus'),
    
    // External API Section elements
    configureApiBtn: document.getElementById('configureApiBtn'),
    connectApiBtn: document.getElementById('connectApiBtn'),
    apiLoadContextBtn: document.getElementById('apiLoadContextBtn'),
    apiClearContextBtn: document.getElementById('apiClearContextBtn'),
    apiModelStatus: document.getElementById('apiModelStatus'),
    apiGenerateSummaryBtn: document.getElementById('apiGenerateSummaryBtn'),
    apiGenerateInsightsBtn: document.getElementById('apiGenerateInsightsBtn'),
    apiQuestionInput: document.getElementById('apiQuestionInput'),
    apiAskQuestionBtn: document.getElementById('apiAskQuestionBtn'),
    
    // Settings Modal Elements
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    cancelSettings: document.getElementById('cancelSettings'),
    saveSettings: document.getElementById('saveSettings'),
    localModelRadio: document.getElementById('localModelRadio'),
    apiModelRadio: document.getElementById('apiModelRadio'),
    localModelSettings: document.getElementById('localModelSettings'),
    apiModelSettings: document.getElementById('apiModelSettings'),
    localModelSelect: document.getElementById('localModelSelect'),
    apiEndpoint: document.getElementById('apiEndpoint'),
    apiKey: document.getElementById('apiKey'),
    apiModelSelect: document.getElementById('apiModelSelect'),
    testConnectionBtn: document.getElementById('testConnectionBtn'),
    refreshModelsBtn: document.getElementById('refreshModelsBtn'),
    connectionStatus: document.getElementById('connectionStatus'),
    connectionStatusText: document.getElementById('connectionStatusText'),
    currentModelType: document.getElementById('currentModelType'),
    currentModel: document.getElementById('currentModel'),
    currentStatus: document.getElementById('currentStatus'),
    
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
    
    // Local AI Features
    elements.generateSummaryBtn.addEventListener('click', () => generateSummary());
    elements.generateInsightsBtn.addEventListener('click', () => generateInsights());
    elements.askQuestionBtn.addEventListener('click', askQuestion);
    
    // External API Features
    elements.apiGenerateSummaryBtn.addEventListener('click', () => generateSummaryWithAPI());
    elements.apiGenerateInsightsBtn.addEventListener('click', () => generateInsightsWithAPI());
    elements.apiAskQuestionBtn.addEventListener('click', askQuestionWithAPI);
    
    // Local AI Management
    elements.initializeLocalBtn.addEventListener('click', initializeLocalLLM);
    elements.loadContextBtn.addEventListener('click', loadTranscriptionIntoContext);
    elements.clearContextBtn.addEventListener('click', clearLLMContext);
    
    // External API Management
    elements.configureApiBtn.addEventListener('click', openSettingsModal);
    elements.connectApiBtn.addEventListener('click', connectAPI);
    elements.apiLoadContextBtn.addEventListener('click', () => {
        console.log('API Load Context button clicked');
        loadTranscriptionIntoContext();
    });
    elements.apiClearContextBtn.addEventListener('click', clearLLMContext);
    
    // Settings Modal
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    elements.closeSettings.addEventListener('click', closeSettingsModal);
    elements.cancelSettings.addEventListener('click', closeSettingsModal);
    elements.saveSettings.addEventListener('click', saveSettings);
    
    // Settings form interactions
    elements.localModelRadio.addEventListener('change', onModelTypeChange);
    elements.apiModelRadio.addEventListener('change', onModelTypeChange);
    elements.apiEndpoint.addEventListener('input', onApiFieldChange);
    elements.apiKey.addEventListener('input', onApiFieldChange);
    elements.testConnectionBtn.addEventListener('click', testConnection);
    elements.refreshModelsBtn.addEventListener('click', refreshModels);
    
    // Actions
    elements.copyBtn.addEventListener('click', copyTranscription);
    elements.saveBtn.addEventListener('click', saveTranscription);
    
    // Toast
    elements.toastClose.addEventListener('click', hideToast);
    
    // Enter key for question inputs
    elements.questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !elements.askQuestionBtn.disabled) {
            askQuestion();
        }
    });
    
    elements.apiQuestionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !elements.apiAskQuestionBtn.disabled) {
            askQuestionWithAPI();
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
    console.log('askQuestion called');
    const question = elements.questionInput.value.trim();
    console.log('Question from local input:', question);
    
    // Check if we should use API input instead
    const apiQuestion = elements.apiQuestionInput.value.trim();
    console.log('Question from API input:', apiQuestion);
    
    // Use API question if we're in API mode
    const finalQuestion = apiQuestion || question;
    console.log('Final question to use:', finalQuestion);
    
    if (!currentTranscription || !finalQuestion) {
        console.log('No transcription or question, returning');
        return;
    }
    
    try {
        elements.askQuestionBtn.disabled = true;
        elements.askQuestionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Asking...';
        
        // Also disable API button if we're using API
        if (apiQuestion) {
            elements.apiAskQuestionBtn.disabled = true;
            elements.apiAskQuestionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Asking...';
        }
        
        // Show AI results container immediately with empty content
        showAIResults(`Q: ${finalQuestion}`, '');
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
        console.log('Using context:', useContext, 'Transcription to pass:', transcriptionToPass ? 'yes' : 'no');
        
        const cleanup = window.electronAPI.askQuestionStream(
            transcriptionToPass,
            finalQuestion,
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
                showAIResults(`Q: ${finalQuestion}`, result);
                
                // Clear the appropriate input field
                if (apiQuestion) {
                    elements.apiQuestionInput.value = '';
                    elements.apiAskQuestionBtn.disabled = false;
                    elements.apiAskQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
                } else {
                    elements.questionInput.value = '';
                    elements.askQuestionBtn.disabled = false;
                    elements.askQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
                }
            },
            // onError
            (error) => {
                isStreaming = false;
                // Remove cancel button
                const cancelButton = elements.aiResults.querySelector('.cancel-stream-btn');
                if (cancelButton) cancelButton.remove();
                showToast('Failed to answer question: ' + error, 'error');
                
                // Reset the appropriate button
                if (apiQuestion) {
                    elements.apiAskQuestionBtn.disabled = false;
                    elements.apiAskQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
                } else {
                    elements.askQuestionBtn.disabled = false;
                    elements.askQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
                }
            }
        );
        
        // Cancel button functionality
        cancelBtn.addEventListener('click', () => {
            isStreaming = false;
            cleanup();
            cancelBtn.remove();
            
            // Reset the appropriate button
            if (apiQuestion) {
                elements.apiAskQuestionBtn.disabled = false;
                elements.apiAskQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
            } else {
                elements.askQuestionBtn.disabled = false;
                elements.askQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
            }
            showToast('Question cancelled', 'info');
        });
        
    } catch (error) {
        console.error('Error in askQuestion:', error);
        showToast('Failed to answer question: ' + error.message, 'error');
        
        // Reset the appropriate button
        if (apiQuestion) {
            elements.apiAskQuestionBtn.disabled = false;
            elements.apiAskQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
        } else {
            elements.askQuestionBtn.disabled = false;
            elements.askQuestionBtn.innerHTML = '<i class="fas fa-question"></i> Ask';
        }
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
async function initializeLocalLLM() {
    try {
        elements.initializeLocalBtn.disabled = true;
        elements.initializeLocalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Model...';
        updateLocalModelStatus('loading', 'Loading...');
        
        const result = await window.electronAPI.initializeLLM();
        
        if (result.success) {
            showToast(result.message, 'success');
            updateLLMStatus();
            elements.initializeLocalBtn.innerHTML = '<i class="fas fa-check"></i> Model Loaded';
            elements.initializeLocalBtn.disabled = false;
        } else {
            showToast(result.message, 'error');
            elements.initializeLocalBtn.disabled = false;
            elements.initializeLocalBtn.innerHTML = '<i class="fas fa-power-off"></i> Load Local Model';
            updateLocalModelStatus('error', 'Failed');
        }
    } catch (error) {
        showToast('Failed to initialize LLM: ' + error.message, 'error');
        elements.initializeLocalBtn.disabled = false;
        elements.initializeLocalBtn.innerHTML = '<i class="fas fa-power-off"></i> Load Local Model';
        updateLocalModelStatus('error', 'Failed');
    }
}

async function loadTranscriptionIntoContext() {
    console.log('loadTranscriptionIntoContext called');
    console.log('currentTranscription:', currentTranscription ? 'exists' : 'null');
    
    if (!currentTranscription) {
        console.log('No transcription available');
        showToast('No transcription available. Please transcribe a file first.', 'error');
        return;
    }
    
    try {
        console.log('Starting to load transcription into context...');
        elements.loadContextBtn.disabled = true;
        elements.loadContextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        elements.apiLoadContextBtn.disabled = true;
        elements.apiLoadContextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        
        console.log('Calling window.electronAPI.loadTranscriptionIntoContext...');
        const result = await window.electronAPI.loadTranscriptionIntoContext(currentTranscription);
        console.log('Result from loadTranscriptionIntoContext:', result);
        
        if (result.success) {
            console.log('Successfully loaded transcription into context');
            showToast(result.message, 'success');
            updateLLMStatus();
            elements.loadContextBtn.innerHTML = '<i class="fas fa-check"></i> Context Loaded';
            
            // Show a brief acknowledgment from the AI
            if (result.acknowledgment) {
                console.log('Showing acknowledgment:', result.acknowledgment);
                showAIResults('LLM Context Loaded', result.acknowledgment);
            }
        } else {
            console.log('Failed to load transcription into context');
            showToast('Failed to load transcription into context', 'error');
        }
    } catch (error) {
        console.error('Error in loadTranscriptionIntoContext:', error);
        showToast('Failed to load transcription: ' + error.message, 'error');
    } finally {
        console.log('Finally block - resetting button state');
        elements.loadContextBtn.disabled = false;
        elements.apiLoadContextBtn.disabled = false;
        
        if (!elements.loadContextBtn.innerHTML.includes('Context Loaded')) {
            elements.loadContextBtn.innerHTML = '<i class="fas fa-upload"></i> Load Transcription into Context';
            elements.apiLoadContextBtn.innerHTML = '<i class="fas fa-upload"></i> Load Transcription into Context';
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
        
        const config = status.config;
        
        // Update Local AI Section
        if (status.isInitialized && config.useLocalModel) {
            // Local model is active
            updateLocalModelStatus('ready', 'Model Ready');
            elements.loadContextBtn.disabled = false;
            elements.initializeLocalBtn.innerHTML = '<i class="fas fa-check"></i> Model Loaded';
            elements.initializeLocalBtn.disabled = false;
        } else {
            // Local model not active
            updateLocalModelStatus('', 'Not Loaded');
            elements.loadContextBtn.disabled = true;
            elements.initializeLocalBtn.innerHTML = '<i class="fas fa-power-off"></i> Load Local Model';
            elements.initializeLocalBtn.disabled = false;
        }
        
        // Update External API Section
        if (!config.useLocalModel && config.apiEndpoint && config.apiKey) {
            // API is configured (even if not initialized yet)
            if (status.isInitialized) {
                updateApiModelStatus('ready', 'Connected');
                elements.configureApiBtn.innerHTML = '<i class="fas fa-check"></i> API Configured';
                elements.connectApiBtn.disabled = true;
                elements.connectApiBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
                elements.apiLoadContextBtn.disabled = false;
                elements.apiClearContextBtn.disabled = !status.hasTranscriptionLoaded;
            } else {
                updateApiModelStatus('', 'Configured (Not Connected)');
                elements.configureApiBtn.innerHTML = '<i class="fas fa-cog"></i> Configure API';
                elements.connectApiBtn.disabled = false;
                elements.connectApiBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
                elements.apiLoadContextBtn.disabled = true;
                elements.apiClearContextBtn.disabled = true;
            }
        } else {
            // API not configured
            updateApiModelStatus('', 'Not Configured');
            elements.configureApiBtn.innerHTML = '<i class="fas fa-cog"></i> Configure API';
            elements.connectApiBtn.disabled = true;
            elements.connectApiBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
            elements.apiLoadContextBtn.disabled = true;
            elements.apiClearContextBtn.disabled = true;
        }
        
        // Update context status (shared between both sections)
        if (status.hasTranscriptionLoaded) {
            elements.clearContextBtn.disabled = false;
            elements.loadContextBtn.innerHTML = '<i class="fas fa-check"></i> Context Loaded';
            elements.apiClearContextBtn.disabled = false;
            elements.apiLoadContextBtn.innerHTML = '<i class="fas fa-check"></i> Context Loaded';
        } else {
            elements.clearContextBtn.disabled = true;
            elements.loadContextBtn.innerHTML = '<i class="fas fa-upload"></i> Load Transcription into Context';
            elements.apiClearContextBtn.disabled = true;
            elements.apiLoadContextBtn.innerHTML = '<i class="fas fa-upload"></i> Load Transcription into Context';
        }
        
        // Enable/disable AI features based on active section
        const isLocalActive = status.isInitialized && config.useLocalModel;
        const isApiConfigured = !config.useLocalModel && config.apiEndpoint && config.apiKey;
        const isApiActive = status.isInitialized && isApiConfigured;
        const hasContext = status.hasTranscriptionLoaded;
        
        // Local AI features
        elements.generateSummaryBtn.disabled = !(isLocalActive && hasContext);
        elements.generateInsightsBtn.disabled = !(isLocalActive && hasContext);
        elements.askQuestionBtn.disabled = !isLocalActive;
        elements.questionInput.disabled = !isLocalActive;
        
        // API features - enable if API is configured (even if not loaded yet)
        elements.apiGenerateSummaryBtn.disabled = !(isApiConfigured && hasContext);
        elements.apiGenerateInsightsBtn.disabled = !(isApiConfigured && hasContext);
        elements.apiAskQuestionBtn.disabled = !isApiConfigured;
        elements.apiQuestionInput.disabled = !isApiConfigured;
        
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

function updateLocalModelStatus(status, text) {
    elements.localModelStatus.textContent = text;
    elements.localModelStatus.className = 'status-indicator';
    if (status) {
        elements.localModelStatus.classList.add(status);
    }
}

function updateApiModelStatus(status, text) {
    elements.apiModelStatus.textContent = text;
    elements.apiModelStatus.className = 'status-indicator';
    if (status) {
        elements.apiModelStatus.classList.add(status);
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

// Settings Modal Functions
async function openSettingsModal() {
    try {
        // Load current configuration
        const status = await window.electronAPI.getLLMStatus();
        const config = status.config;
        
        // Set form values
        if (config.useLocalModel) {
            elements.localModelRadio.checked = true;
            elements.apiModelRadio.checked = false;
        } else {
            elements.localModelRadio.checked = false;
            elements.apiModelRadio.checked = true;
        }
        
        elements.localModelSelect.value = config.selectedModel || 'qwen3-1.7b-q4_0';
        elements.apiEndpoint.value = config.apiEndpoint || '';
        elements.apiKey.value = config.apiKey || '';
        
        // Update UI based on model type
        onModelTypeChange();
        
        // Update status display
        updateSettingsStatus(status);
        
        // Show modal
        elements.settingsModal.classList.remove('hidden');
        
    } catch (error) {
        showToast('Failed to load settings: ' + error.message, 'error');
    }
}

function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
    hideConnectionStatus();
}

function onModelTypeChange() {
    const useLocal = elements.localModelRadio.checked;
    
    if (useLocal) {
        elements.localModelSettings.classList.remove('hidden');
        elements.apiModelSettings.classList.add('hidden');
    } else {
        elements.localModelSettings.classList.add('hidden');
        elements.apiModelSettings.classList.remove('hidden');
        onApiFieldChange();
    }
}

function onApiFieldChange() {
    const hasEndpoint = elements.apiEndpoint.value.trim() !== '';
    const hasKey = elements.apiKey.value.trim() !== '';
    
    elements.testConnectionBtn.disabled = !hasEndpoint || !hasKey;
    elements.refreshModelsBtn.disabled = !hasEndpoint || !hasKey;
    elements.apiModelSelect.disabled = !hasEndpoint || !hasKey;
}

async function testConnection() {
    const endpoint = elements.apiEndpoint.value.trim();
    const key = elements.apiKey.value.trim();
    const model = elements.apiModelSelect.value;
    
    if (!endpoint || !key) {
        showToast('Please enter API endpoint and key', 'error');
        return;
    }
    
    try {
        showConnectionStatus('Testing connection...', 'loading');
        
        // Temporarily update configuration for testing
        await window.electronAPI.updateLLMConfiguration({
            useLocalModel: false,
            apiEndpoint: endpoint,
            apiKey: key,
            selectedModel: model
        });
        
        const result = await window.electronAPI.testLLMConnection();
        
        if (result.success) {
            showConnectionStatus('Connection successful!', 'success');
            showToast(result.message, 'success');
        } else {
            showConnectionStatus('Connection failed', 'error');
            showToast(result.message, 'error');
        }
    } catch (error) {
        showConnectionStatus('Connection failed', 'error');
        showToast('Connection test failed: ' + error.message, 'error');
    }
}

async function refreshModels() {
    const endpoint = elements.apiEndpoint.value.trim();
    const key = elements.apiKey.value.trim();
    
    if (!endpoint || !key) {
        showToast('Please enter API endpoint and key', 'error');
        return;
    }
    
    try {
        showConnectionStatus('Loading models...', 'loading');
        
        // Temporarily update configuration for fetching models
        await window.electronAPI.updateLLMConfiguration({
            useLocalModel: false,
            apiEndpoint: endpoint,
            apiKey: key
        });
        
        const models = await window.electronAPI.getAvailableModels();
        
        // Populate model select
        elements.apiModelSelect.innerHTML = '';
        if (models.length > 0) {
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                elements.apiModelSelect.appendChild(option);
            });
            
            showConnectionStatus(`Found ${models.length} models`, 'success');
            showToast(`Loaded ${models.length} available models`, 'success');
        } else {
            elements.apiModelSelect.innerHTML = '<option value="">No models found</option>';
            showConnectionStatus('No models found', 'error');
            showToast('No models found on this API endpoint', 'error');
        }
    } catch (error) {
        showConnectionStatus('Failed to load models', 'error');
        showToast('Failed to load models: ' + error.message, 'error');
    }
}

async function saveSettings() {
    try {
        const useLocal = elements.localModelRadio.checked;
        const config = {
            useLocalModel: useLocal
        };
        
        if (useLocal) {
            config.selectedModel = elements.localModelSelect.value;
        } else {
            config.apiEndpoint = elements.apiEndpoint.value.trim();
            config.apiKey = elements.apiKey.value.trim();
            config.selectedModel = elements.apiModelSelect.value;
            
            if (!config.apiEndpoint || !config.apiKey) {
                showToast('Please enter API endpoint and key', 'error');
                return;
            }
        }
        
        await window.electronAPI.updateLLMConfiguration(config);
        
        // Update status display
        const status = await window.electronAPI.getLLMStatus();
        updateSettingsStatus(status);
        
        // Update main UI status
        updateLLMStatus();
        
        closeSettingsModal();
        showToast('Settings saved successfully', 'success');
        
    } catch (error) {
        showToast('Failed to save settings: ' + error.message, 'error');
    }
}

function updateSettingsStatus(status) {
    const config = status.config;
    
    elements.currentModelType.textContent = config.useLocalModel ? 'Local' : 'API';
    elements.currentModel.textContent = config.selectedModel || 'Not selected';
    
    if (status.isInitialized) {
        elements.currentStatus.textContent = 'Ready';
        elements.currentStatus.style.color = '#10B981';
    } else {
        elements.currentStatus.textContent = 'Not Loaded';
        elements.currentStatus.style.color = '#6B7280';
    }
    
    // Update the main UI status
    updateLLMStatus();
}

function showConnectionStatus(message, type) {
    elements.connectionStatusText.textContent = message;
    elements.connectionStatus.className = `connection-status ${type}`;
    elements.connectionStatus.classList.remove('hidden');
}

function hideConnectionStatus() {
    elements.connectionStatus.classList.add('hidden');
}

// API-specific functions that handle initialization
async function generateSummaryWithAPI() {
    await ensureAPIInitialized();
    generateSummary();
}

async function generateInsightsWithAPI() {
    await ensureAPIInitialized();
    generateInsights();
}

async function askQuestionWithAPI() {
    console.log('askQuestionWithAPI called');
    try {
        await ensureAPIInitialized();
        console.log('API initialized, calling askQuestion');
        askQuestion();
    } catch (error) {
        console.error('Error in askQuestionWithAPI:', error);
    }
}

async function connectAPI() {
    try {
        elements.connectApiBtn.disabled = true;
        elements.connectApiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        updateApiModelStatus('loading', 'Connecting...');
        
        await window.electronAPI.initializeLLM();
        updateLLMStatus();
        
        showToast('API connected successfully', 'success');
    } catch (error) {
        showToast('Failed to connect API: ' + error.message, 'error');
        elements.connectApiBtn.disabled = false;
        elements.connectApiBtn.innerHTML = '<i class="fas fa-plug"></i> Connect';
        updateApiModelStatus('error', 'Connection Failed');
    }
}

async function ensureAPIInitialized() {
    const status = await window.electronAPI.getLLMStatus();
    if (!status.isInitialized) {
        try {
            showToast('Initializing API connection...', 'info');
            await window.electronAPI.initializeLLM();
            updateLLMStatus();
            showToast('API initialized successfully', 'success');
        } catch (error) {
            showToast('Failed to initialize API: ' + error.message, 'error');
            throw error;
        }
    }
}