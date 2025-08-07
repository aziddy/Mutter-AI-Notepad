import React from 'react';

const TranscriptionProgress: React.FC = () => {
  return (
    <div className="progress-section">
      <div className="progress-content">
        <div className="spinner"></div>
        <p>Processing...</p>
      </div>
    </div>
  );
};

export default TranscriptionProgress;