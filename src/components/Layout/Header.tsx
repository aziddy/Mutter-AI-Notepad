import React from 'react';

interface HeaderProps {
  onSettingsClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSettingsClick }) => {
  const handleSettingsClick = () => {
    onSettingsClick?.();
  };

  return (
    <header className="header">
      <div className="header-content">
        <h1>
          <i className="fas fa-microphone"></i> Mutter AI Notepad
        </h1>
        <div className="header-actions">
          <button 
            id="settingsBtn" 
            className="btn btn-icon" 
            title="Settings"
            onClick={handleSettingsClick}
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;