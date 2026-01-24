import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { SRTEntry, SpeakerSegment } from '../../types';

// Speaker color palette
const SPEAKER_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

interface SRTViewerProps {
  srtContent: string;
  currentPlayingEntry: SRTEntry | null;
  onEntryClick: (entry: SRTEntry) => void;
  viewMode?: 'segmented' | 'continuous';
  speakerSegments?: SpeakerSegment[];
}

const SRTViewer: React.FC<SRTViewerProps> = ({
  srtContent,
  currentPlayingEntry,
  onEntryClick,
  viewMode = 'segmented',
  speakerSegments,
}) => {
  const continuousContainerRef = useRef<HTMLDivElement>(null);
  const playingEntryRef = useRef<HTMLSpanElement>(null);

  // Generate speaker color map
  const speakerColors = useMemo(() => {
    if (!speakerSegments || speakerSegments.length === 0) return {};
    const uniqueSpeakers = [...new Set(speakerSegments.map(s => s.speaker).filter(Boolean))];
    const colorMap: Record<string, string> = {};
    uniqueSpeakers.forEach((speaker, index) => {
      colorMap[speaker] = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
    });
    return colorMap;
  }, [speakerSegments]);

  // Find speaker for a given time range
  const findSpeakerForEntry = useCallback((startTime: number, endTime: number): { speaker: string | null; color: string | null } => {
    if (!speakerSegments || speakerSegments.length === 0) {
      return { speaker: null, color: null };
    }
    // Find the segment with the most overlap
    let bestMatch: SpeakerSegment | null = null;
    let maxOverlap = 0;
    for (const segment of speakerSegments) {
      const overlapStart = Math.max(startTime, segment.start);
      const overlapEnd = Math.min(endTime, segment.end);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = segment;
      }
    }
    if (bestMatch && bestMatch.speaker) {
      return { speaker: bestMatch.speaker, color: speakerColors[bestMatch.speaker] || null };
    }
    return { speaker: null, color: null };
  }, [speakerSegments, speakerColors]);
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

  // Auto-scroll to playing entry in continuous view
  useEffect(() => {
    if (viewMode === 'continuous' && playingEntryRef.current && continuousContainerRef.current) {
      playingEntryRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentPlayingEntry, viewMode]);

  if (srtEntries.length === 0) {
    return (
      <div className="transcription-srt">
        <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>
          No SRT data available
        </p>
      </div>
    );
  }

  // Render continuous view
  if (viewMode === 'continuous') {
    return (
      <div className="transcription-srt-continuous" ref={continuousContainerRef}>
        {srtEntries.map((entry, index) => {
          const isPlaying = currentPlayingEntry &&
            currentPlayingEntry.startTime === entry.startTime &&
            currentPlayingEntry.endTime === entry.endTime;
          const { speaker, color } = findSpeakerForEntry(entry.startTime, entry.endTime);

          return (
            <span
              key={index}
              ref={isPlaying ? playingEntryRef : null}
              className={`srt-continuous-entry ${isPlaying ? 'playing' : ''}`}
              onClick={() => handleEntryClick(entry)}
              title={`${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}${speaker ? ` (${speaker})` : ''}`}
              style={color ? { borderLeft: `3px solid ${color}`, paddingLeft: '8px', marginLeft: '4px' } : undefined}
            >
              {entry.text}
            </span>
          );
        })}
      </div>
    );
  }

  // Render segmented view (default)
  return (
    <div className="transcription-srt">
      {srtEntries.map((entry, index) => {
        const isPlaying = currentPlayingEntry &&
          currentPlayingEntry.startTime === entry.startTime &&
          currentPlayingEntry.endTime === entry.endTime;
        const { speaker, color } = findSpeakerForEntry(entry.startTime, entry.endTime);

        return (
          <div
            key={index}
            className={`srt-entry ${isPlaying ? 'playing' : ''}`}
            onClick={() => handleEntryClick(entry)}
          >
            <div className="srt-entry-header">
              {speaker && color && (
                <span
                  className="srt-speaker-label"
                  style={{ backgroundColor: color }}
                >
                  {speaker}
                </span>
              )}
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