const path = require('path');
const fs = require('fs');

class DiarizationConfigService {
  constructor() {
    this.config = {
      enabled: false,
      backend: 'fluidaudio', // 'fluidaudio' or 'pyannote'
      hfToken: ''
    };
    this.loadConfiguration();
  }

  loadConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'diarization-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        this.config = { ...this.config, ...config };
      }
    } catch (error) {
      console.warn('Failed to load diarization configuration:', error);
    }
  }

  saveConfiguration() {
    try {
      const configPath = path.join(process.cwd(), 'diarization-config.json');
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save diarization configuration:', error);
    }
  }

  getConfig() {
    return this.config;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.saveConfiguration();
    return { success: true, message: 'Diarization configuration updated successfully' };
  }
}

module.exports = { DiarizationConfigService };
