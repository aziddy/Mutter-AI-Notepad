import React from 'react';
import { useAppContext } from '../../contexts/AppContext';
import WelcomeScreen from '../WelcomeScreen';
import FileInfo from '../FileUpload/FileInfo';
import TranscriptionProgress from '../FileUpload/TranscriptionProgress';
import TranscriptionResults from '../Transcription/TranscriptionResults';

interface MainContentProps {
  onSettingsClick?: () => void;
}

const MainContent: React.FC<MainContentProps> = ({ onSettingsClick }) => {
  const { state } = useAppContext();

  return (
    <div className="content">
      {state.showWelcomeScreen && <WelcomeScreen />}
      {state.showFileInfo && <FileInfo />}
      {state.showProgressSection && <TranscriptionProgress />}
      {state.showResultsSection && <TranscriptionResults onSettingsClick={onSettingsClick} />}
    </div>
  );
};

export default MainContent;