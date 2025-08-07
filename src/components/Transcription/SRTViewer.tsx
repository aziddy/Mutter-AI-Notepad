import React, { useCallback, useMemo } from 'react';
import { SRTEntry } from '../../types';

interface SRTViewerProps {
  srtContent: string;
  currentPlayingEntry: SRTEntry | null;
  onEntryClick: (entry: SRTEntry) => void;
}

const SRTViewer: React.FC<SRTViewerProps> = ({
  srtContent,
  currentPlayingEntry,
  onEntryClick,
}) => {
  // Parse SRT content into entries
  const srtEntries = useMemo(() => {
    if (!srtContent) return [];
    
    const entries: SRTEntry[] = [];
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
        startTime,
        endTime,
        text
      });
    }
    
    return entries;
  }, [srtContent]);

  // Format time for display
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Handle entry click
  const handleEntryClick = useCallback((entry: SRTEntry) => {
    onEntryClick(entry);
  }, [onEntryClick]);

  if (srtEntries.length === 0) {
    return (
      <div className="transcription-srt">
        <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>
          No SRT data available
        </p>
      </div>
    );
  }

  return (
    <div className="transcription-srt">
      {srtEntries.map((entry, index) => {
        const isPlaying = currentPlayingEntry && 
          currentPlayingEntry.startTime === entry.startTime && 
          currentPlayingEntry.endTime === entry.endTime;
        
        return (
          <div
            key={index}
            className={`srt-entry ${isPlaying ? 'playing' : ''}`}
            onClick={() => handleEntryClick(entry)}
          >
            <div className="srt-entry-header">
              <span className="srt-entry-number">#{index + 1}</span>
              <span className="srt-entry-time">
                {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
              </span>
            </div>
            <div className="srt-entry-text">{entry.text}</div>
          </div>
        );
      })}
    </div>
  );
};

export default SRTViewer;