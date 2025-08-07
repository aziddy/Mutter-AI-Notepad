import React, { useRef, useEffect, useState, useCallback } from 'react';
import { AudioPlayerState, SRTEntry } from '../../types';

interface AudioPlayerProps {
  audioSource: string | null;
  srtEntries: SRTEntry[];
  onCurrentTimeChange?: (currentTime: number) => void;
  onPlayingEntryChange?: (entry: SRTEntry | null) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioSource,
  srtEntries,
  onCurrentTimeChange,
  onPlayingEntryChange,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playerState, setPlayerState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    isMuted: false,
    isLoaded: false,
  });
  const [currentPlayingEntry, setCurrentPlayingEntry] = useState<SRTEntry | null>(null);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Update current time and sync with SRT entries
  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentTime = audio.currentTime;
    setPlayerState(prev => ({ ...prev, currentTime }));
    onCurrentTimeChange?.(currentTime);

    // Find current SRT entry
    const currentEntry = srtEntries.find(entry => 
      currentTime >= entry.startTime && currentTime <= entry.endTime
    );

    if (currentEntry !== currentPlayingEntry) {
      setCurrentPlayingEntry(currentEntry || null);
      onPlayingEntryChange?.(currentEntry || null);
    }
  }, [srtEntries, currentPlayingEntry, onCurrentTimeChange, onPlayingEntryChange]);

  // Audio event handlers
  const handleLoadedMetadata = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlayerState(prev => ({
      ...prev,
      duration: audio.duration,
      isLoaded: true,
    }));
  }, []);

  const handlePlay = useCallback(() => {
    setPlayerState(prev => ({ ...prev, isPlaying: true }));
  }, []);

  const handlePause = useCallback(() => {
    setPlayerState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const handleEnded = useCallback(() => {
    setPlayerState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    setCurrentPlayingEntry(null);
    onPlayingEntryChange?.(null);
  }, [onPlayingEntryChange]);

  // Control functions
  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !playerState.isLoaded) return;

    if (playerState.isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [playerState.isPlaying, playerState.isLoaded]);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio || !playerState.isLoaded) return;

    audio.currentTime = time;
    setPlayerState(prev => ({ ...prev, currentTime: time }));
  }, [playerState.isLoaded]);

  const handleSeekSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = (parseFloat(e.target.value) / 100) * playerState.duration;
    seekTo(seekTime);
  }, [playerState.duration, seekTo]);

  const setVolume = useCallback((volume: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const volumeValue = Math.max(0, Math.min(100, volume)) / 100;
    audio.volume = volumeValue;
    setPlayerState(prev => ({
      ...prev,
      volume: Math.round(volumeValue * 100),
      isMuted: volumeValue === 0,
    }));
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  }, [setVolume]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playerState.isMuted) {
      audio.volume = playerState.volume / 100;
      setPlayerState(prev => ({ ...prev, isMuted: false }));
    } else {
      audio.volume = 0;
      setPlayerState(prev => ({ ...prev, isMuted: true }));
    }
  }, [playerState.isMuted, playerState.volume]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!audioSource || !playerState.isLoaded) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekTo(Math.max(0, playerState.currentTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekTo(Math.min(playerState.duration, playerState.currentTime + 5));
          break;
      }
    };

    // Only add keyboard listener when SRT tab is active
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [audioSource, playerState.isLoaded, playerState.currentTime, playerState.duration, togglePlayPause, seekTo]);

  // Jump to SRT entry time
  const jumpToEntry = useCallback((entry: SRTEntry) => {
    seekTo(entry.startTime);
  }, [seekTo]);

  // Expose jumpToEntry function
  useEffect(() => {
    // Store reference for parent components to access
    (audioRef.current as any)?.jumpToEntry && ((audioRef.current as any).jumpToEntry = jumpToEntry);
  }, [jumpToEntry]);

  if (!audioSource) {
    return null;
  }

  const progressPercentage = playerState.duration > 0 ? (playerState.currentTime / playerState.duration) * 100 : 0;

  return (
    <div className="audio-player-section">
      <div className="audio-player">
        <audio
          ref={audioRef}
          src={`file://${audioSource}`}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
        />
        
        <div className="audio-controls">
          <button
            className="btn btn-icon"
            onClick={togglePlayPause}
            disabled={!playerState.isLoaded}
            title={playerState.isPlaying ? 'Pause' : 'Play'}
          >
            <i className={`fas ${playerState.isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
          </button>

          <div className="audio-progress">
            <span className="time-display">{formatTime(playerState.currentTime)}</span>
            
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressPercentage}%` }}
              ></div>
              <input
                type="range"
                className="progress-slider"
                min="0"
                max="100"
                value={progressPercentage}
                onChange={handleSeekSliderChange}
                disabled={!playerState.isLoaded}
              />
            </div>

            <span className="time-display">{formatTime(playerState.duration)}</span>
          </div>

          <div className="audio-volume">
            <button
              className="btn btn-icon"
              onClick={toggleMute}
              title={playerState.isMuted ? 'Unmute' : 'Mute'}
            >
              <i className={`fas ${
                playerState.isMuted || playerState.volume === 0 
                  ? 'fa-volume-mute' 
                  : playerState.volume < 50 
                  ? 'fa-volume-down' 
                  : 'fa-volume-up'
              }`}></i>
            </button>
            
            <input
              type="range"
              className="volume-slider"
              min="0"
              max="100"
              value={playerState.isMuted ? 0 : playerState.volume}
              onChange={handleVolumeChange}
            />
          </div>
        </div>

        <div className="audio-help">
          <small>Keyboard shortcuts: Space (play/pause), ← → (seek 5s), Click SRT entries to jump</small>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;