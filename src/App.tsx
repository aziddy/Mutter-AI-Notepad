import { useState } from 'react';
import { AppProvider } from './contexts/AppContext';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import MainContent from './components/Layout/MainContent';
import Toast from './components/UI/Toast';
import SettingsModal from './components/Settings/SettingsModal';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  return (
    <ErrorBoundary>
      <AppProvider>
        <div className="app">
          <Header onSettingsClick={handleOpenSettings} />
          <main className="main">
            <ErrorBoundary>
              <Sidebar />
            </ErrorBoundary>
            <ErrorBoundary>
              <MainContent onSettingsClick={handleOpenSettings} />
            </ErrorBoundary>
          </main>
          <Toast />
          <ErrorBoundary>
            <SettingsModal 
              isOpen={isSettingsOpen} 
              onClose={handleCloseSettings} 
            />
          </ErrorBoundary>
        </div>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;