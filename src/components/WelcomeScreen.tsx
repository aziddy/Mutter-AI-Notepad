import React from 'react';

const WelcomeScreen: React.FC = () => {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <i className="fas fa-microphone welcome-icon"></i>
        <h2>Welcome to Mutter AI Notepad</h2>
        <p>Upload an audio or video file to get started with local transcription</p>
        <div className="features">
          <div className="feature">
            <i className="fas fa-shield-alt"></i>
            <span>100% Local Processing</span>
          </div>
          <div className="feature">
            <i className="fas fa-bolt"></i>
            <span>Powered by OpenAI Whisper</span>
          </div>
          <div className="feature">
            <i className="fas fa-robot"></i>
            <span>Local Qwen3 or API AI Analysis</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;