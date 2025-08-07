const fs = require('fs');
const path = require('path');
const { https } = require('follow-redirects');
const { pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);

// Configuration - Using Unsloth's Qwen3 models
const MODEL_NAME = 'qwen3-0.6b';
const MODELS_DIR = path.join(__dirname, 'models');
const MODEL_DIR = path.join(MODELS_DIR, 'qwen3-0.6b');

// Unsloth GGUF URLs for different quantizations
const GGUF_URLS = {
    'q4_0': 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf',
    'q4_1': 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_1.gguf',
    'q5_k_s': 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q5_K_S.gguf',
    'q5_k_m': 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q5_K_M.gguf',
    'q8_0': 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q8_0.gguf'
};

// Qwen3-1.7B model URLs
const QWEN3_1_7B_URLS = {
    'q4_0': 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_0.gguf?download=true', // 1.06GB | 4.6GB of RAM | Alot Faster than q8_0
    'q8_0': 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q8_0.gguf?download=true'  // 1.83GB | 4.6GB of RAM
};

// All available models
const ALL_MODELS = {
    'qwen3-0.6b': {
        name: 'Qwen3-0.6B',
        urls: GGUF_URLS,
        default_quant: 'q4_0'
    },
    'qwen3-1.7b': {
        name: 'Qwen3-1.7B',
        urls: QWEN3_1_7B_URLS,
        default_quant: 'q8_0'
    }
};

// Test URL accessibility
async function testUrl(url) {
    return new Promise((resolve) => {
        const request = https.get(url, (response) => {
            resolve({
                accessible: response.statusCode === 200,
                statusCode: response.statusCode,
                contentLength: response.headers['content-length']
            });
        });
        
        request.on('error', (err) => {
            resolve({
                accessible: false,
                error: err.message
            });
        });
        
        request.setTimeout(10000, () => {
            request.destroy();
            resolve({
                accessible: false,
                error: 'Timeout'
            });
        });
    });
}

// Test all URLs and show results
async function testAllUrls(modelName = 'qwen3-0.6b') {
    const model = ALL_MODELS[modelName];
    if (!model) {
        console.error(`Unknown model: ${modelName}. Available models: ${Object.keys(ALL_MODELS).join(', ')}`);
        return;
    }
    
    console.log(`Testing Unsloth ${model.name} model URLs...\n`);
    
    const results = {};
    
    for (const [quant, url] of Object.entries(model.urls)) {
        console.log(`Testing ${quant}...`);
        const result = await testUrl(url);
        results[quant] = result;
        
        if (result.accessible) {
            const sizeMB = result.contentLength ? (parseInt(result.contentLength) / 1024 / 1024).toFixed(1) : 'Unknown';
            console.log(`  ✅ ${quant}: Accessible (${sizeMB}MB)`);
        } else {
            console.log(`  ❌ ${quant}: Not accessible (${result.statusCode || result.error})`);
        }
    }
    
    console.log('\nSummary:');
    const accessible = Object.entries(results).filter(([_, result]) => result.accessible);
    const inaccessible = Object.entries(results).filter(([_, result]) => !result.accessible);
    
    if (accessible.length > 0) {
        console.log(`✅ ${accessible.length} quantizations are accessible:`);
        accessible.forEach(([quant, result]) => {
            const sizeMB = result.contentLength ? (parseInt(result.contentLength) / 1024 / 1024).toFixed(1) : 'Unknown';
            console.log(`   - ${quant}: ${sizeMB}MB`);
        });
    }
    
    if (inaccessible.length > 0) {
        console.log(`❌ ${inaccessible.length} quantizations are not accessible:`);
        inaccessible.forEach(([quant, result]) => {
            console.log(`   - ${quant}: ${result.statusCode || result.error}`);
        });
    }
    
    return results;
}

// Create directories if they don't exist
function ensureDirectories() {
    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true });
        console.log(`Created models directory: ${MODELS_DIR}`);
    }
    
    if (!fs.existsSync(MODEL_DIR)) {
        fs.mkdirSync(MODEL_DIR, { recursive: true });
        console.log(`Created model directory: ${MODEL_DIR}`);
    }
}

// Download file with progress and better error handling
async function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);
        
        const request = https.get(url, (response) => {
            // Check for authentication errors or other HTTP errors
            if (response.statusCode === 401 || response.statusCode === 403) {
                reject(new Error(`Authentication failed (${response.statusCode}): The model requires authentication or the URL has changed. Please check the model URL.`));
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: Failed to download model. The URL may be invalid or the model may not be available.`));
                return;
            }
            
            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;
            let lastProgress = 0;
            
            // Check if we're getting an error page instead of the model
            let isErrorPage = false;
            let responseData = '';
            
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                
                // Check first few chunks for error messages
                if (downloadedSize < 1024) {
                    responseData += chunk.toString();
                    if (responseData.includes('Invalid username or password') || 
                        responseData.includes('error') || 
                        responseData.includes('Error')) {
                        isErrorPage = true;
                        reject(new Error('Received error page instead of model file. The URL may be invalid or require authentication.'));
                        return;
                    }
                }
                
                const progress = Math.round((downloadedSize / totalSize) * 100);
                
                if (progress > lastProgress) {
                    process.stdout.write(`\rDownloading: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
                    lastProgress = progress;
                }
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                
                // Verify the downloaded file is actually a model (not an error page)
                const stats = fs.statSync(destination);
                if (stats.size < 1024 * 1024) { // Less than 1MB is suspicious
                    fs.unlink(destination, () => {});
                    reject(new Error('Downloaded file is too small to be a valid model. The URL may be invalid.'));
                    return;
                }
                
                console.log('\nDownload completed successfully!');
                resolve();
            });
            
            file.on('error', (err) => {
                fs.unlink(destination, () => {}); // Delete the file if there was an error
                reject(err);
            });
        });
        
        request.on('error', (err) => {
            reject(new Error(`Network error: ${err.message}`));
        });
        
        request.setTimeout(30000, () => { // 30 second timeout
            request.destroy();
            reject(new Error('Download timeout. Please check your internet connection.'));
        });
    });
}

// Download GGUF quantized model
async function downloadGGUFModel(modelName = 'qwen3-0.6b', quantization = null) {
    const model = ALL_MODELS[modelName];
    if (!model) {
        throw new Error(`Invalid model: ${modelName}. Available models: ${Object.keys(ALL_MODELS).join(', ')}`);
    }
    
    // Use default quantization if none specified
    if (!quantization) {
        quantization = model.default_quant;
    }
    
    const ggufUrl = model.urls[quantization];
    if (!ggufUrl) {
        throw new Error(`Invalid quantization: ${quantization}. Available options for ${model.name}: ${Object.keys(model.urls).join(', ')}`);
    }
    
    const fileName = `${modelName}.${quantization}.gguf`;
    const modelDir = path.join(MODELS_DIR, modelName);
    const filePath = path.join(modelDir, fileName);
    
    try {
        console.log(`Starting Unsloth ${model.name} ${quantization.toUpperCase()} GGUF model download...`);
        console.log(`Model URL: ${ggufUrl}`);
        console.log(`Destination: ${filePath}`);
        
        // Ensure directories exist
        ensureDirectories();
        
        // Create model-specific directory if it doesn't exist
        if (!fs.existsSync(modelDir)) {
            fs.mkdirSync(modelDir, { recursive: true });
            console.log(`Created model directory: ${modelDir}`);
        }
        
        // Check if model already exists
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            const fileSizeInMB = stats.size / 1024 / 1024;
            
            // Check if existing file is valid (not an error page)
            if (stats.size < 1024 * 1024) {
                console.log('Existing file appears to be invalid (too small). Removing and re-downloading...');
                fs.unlinkSync(filePath);
            } else {
                console.log(`Model already exists at ${filePath} (${fileSizeInMB.toFixed(1)}MB)`);
                console.log('Skipping download. If you want to re-download, delete the existing file first.');
                return filePath;
            }
        }
        
        // Download the model
        console.log('Downloading model file...');
        await downloadFile(ggufUrl, filePath);
        
        // Verify the download
        const stats = fs.statSync(filePath);
        const fileSizeInMB = stats.size / 1024 / 1024;
        console.log(`\nModel downloaded successfully!`);
        console.log(`File size: ${fileSizeInMB.toFixed(1)}MB`);
        console.log(`Location: ${filePath}`);
        
        return filePath;
        
    } catch (error) {
        console.error('\nError downloading model:', error.message);
        console.log('\nTroubleshooting tips:');
        console.log('1. Check your internet connection');
        console.log('2. The model URL may have changed - check Hugging Face for the latest link');
        console.log('3. Some models require authentication - you may need to log in to Hugging Face');
        console.log(`4. Try downloading manually from: https://huggingface.co/unsloth/${model.name.replace(' ', '')}-GGUF`);
        throw error;
    }
}

// Main function
async function downloadQwen3Model(modelName = 'qwen3-0.6b', quantization = null) {
    try {
        await downloadGGUFModel(modelName, quantization);
    } catch (error) {
        console.error('\nFailed to download model:', error.message);
        process.exit(1);
    }
}

// Show available options
function showOptions() {
    console.log('\nAvailable Unsloth Qwen3 models:');
    console.log('================================');
    
    for (const [modelKey, model] of Object.entries(ALL_MODELS)) {
        console.log(`\n${model.name} (${modelKey}):`);
        console.log('GGUF Quantized Models:');
        Object.keys(model.urls).forEach(quant => {
            console.log(`  - ${quant}: ${modelKey}.${quant}.gguf`);
        });
    }
    
    console.log('\nUsage:');
    console.log('  npm run download-qwen3                    # Downloads qwen3-0.6b q4_0 (default)');
    console.log('  node download-qwen3.js                    # Downloads qwen3-0.6b q4_0 (default)');
    console.log('  node download-qwen3.js qwen3-0.6b q4_0   # Downloads qwen3-0.6b q4_0');
    console.log('  node download-qwen3.js qwen3-1.7b q8_0   # Downloads qwen3-1.7b q8_0');
    console.log('  node download-qwen3.js --test            # Test all URLs for qwen3-0.6b');
    console.log('  node download-qwen3.js --test qwen3-1.7b # Test all URLs for qwen3-1.7b');
    console.log('  node download-qwen3.js --help            # Shows this help');
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showOptions();
        process.exit(0);
    }
    
    if (args.includes('--test')) {
        const testIndex = args.indexOf('--test');
        const modelName = args[testIndex + 1] || 'qwen3-0.6b';
        return { action: 'test', modelName };
    }
    
    // Handle model and quantization arguments
    const modelName = args[0] || 'qwen3-0.6b';
    const quantization = args[1] || null; // Will use default quantization if not specified
    
    return { action: 'download', modelName, quantization };
}

// Run the script
if (require.main === module) {
    const args = parseArgs();
    
    if (args.action === 'test') {
        testAllUrls(args.modelName);
    } else {
        downloadQwen3Model(args.modelName, args.quantization);
    }
}

module.exports = { downloadQwen3Model, downloadGGUFModel, testAllUrls, showOptions }; 