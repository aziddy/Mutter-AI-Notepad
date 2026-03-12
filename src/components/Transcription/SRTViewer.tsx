import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { SRTEntry, SpeakerSegment } from '../../types';
import HighlightedText from '../Search/HighlightedText';

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
  speakerNames?: Record<string, string>;
  speakers?: string[];
  onSpeakerChange?: (entryStartTime: number, entryEndTime: number, newSpeaker: string) => void;
  // Search props
  searchQuery?: string;
  caseSensitive?: boolean;
  currentMatchIndex?: number;
}

const SRTViewer: React.FC<SRTViewerProps> = ({
  srtContent,
  currentPlayingEntry,
  onEntryClick,
  viewMode = 'segmented',
  speakerSegments,
  speakerNames,
  speakers,
  onSpeakerChange,
  searchQuery,
  caseSensitive = false,
  currentMatchIndex = 0,
}) => {
  const continuousContainerRef = useRef<HTMLDivElement>(null);
  const playingEntryRef = useRef<HTMLSpanElement>(null);

  // Generate speaker color map
  const speakerColors = useMemo(() => {
    if (!speakerSegments || speakerSegments.length === 0) return {};
    const uniqueSpeakers = speakers && speakers.length > 0
      ? speakers
      : [...new Set(speakerSegments.map(s => s.speaker).filter(Boolean))];
    const colorMap: Record<string, string> = {};
    uniqueSpeakers.forEach((speaker, index) => {
      colorMap[speaker] = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
    });
    return colorMap;
  }, [speakerSegments, speakers]);

  // Find speaker for a given time range
  const findSpeakerForEntry = useCallback((startTime: number, endTime: number): { speaker: string | null; color: string | null; isReassigned: boolean } => {
    if (!speakerSegments || speakerSegments.length === 0) {
      return { speaker: null, color: null, isReassigned: false };
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
      const isReassigned = !!bestMatch.originalSpeaker && bestMatch.originalSpeaker !== bestMatch.speaker;
      return { speaker: bestMatch.speaker, color: speakerColors[bestMatch.speaker] || null, isReassigned };
    }
    return { speaker: null, color: null, isReassigned: false };
  }, [speakerSegments, speakerColors]);

  // Speaker dropdown state
  const [speakerDropdown, setSpeakerDropdown] = useState<{
    entryIndex: number;
    startTime: number;
    endTime: number;
    currentSpeaker: string;
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Open dropdown on speaker label click
  const handleSpeakerLabelClick = useCallback((e: React.MouseEvent, entryIndex: number, entry: SRTEntry, currentSpeaker: string) => {
    e.stopPropagation();
    if (!speakers || speakers.length < 2 || !onSpeakerChange) return;
    setSpeakerDropdown(prev =>
      prev?.entryIndex === entryIndex ? null : { entryIndex, startTime: entry.startTime, endTime: entry.endTime, currentSpeaker }
    );
  }, [speakers, onSpeakerChange]);

  // Select speaker from dropdown
  const handleDropdownSelect = useCallback((e: React.MouseEvent, newSpeaker: string) => {
    e.stopPropagation();
    if (!speakerDropdown || !onSpeakerChange) return;
    onSpeakerChange(speakerDropdown.startTime, speakerDropdown.endTime, newSpeaker);
    setSpeakerDropdown(null);
  }, [speakerDropdown, onSpeakerChange]);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!speakerDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSpeakerDropdown(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpeakerDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [speakerDropdown]);
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

  // Escape special regex characters
  const escapeRegex = useCallback((str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }, []);

  // Calculate match start index for each entry (cumulative count of matches before this entry)
  const matchStartIndices = useMemo(() => {
    if (!searchQuery) return [];

    const indices: number[] = [];
    let cumulativeMatches = 0;

    try {
      const flags = caseSensitive ? 'g' : 'gi';

      for (const entry of srtEntries) {
        indices.push(cumulativeMatches);
        const regex = new RegExp(escapeRegex(searchQuery), flags);
        const matches = entry.text.match(regex);
        cumulativeMatches += matches ? matches.length : 0;
      }
    } catch {
      return srtEntries.map(() => 0);
    }

    return indices;
  }, [srtEntries, searchQuery, caseSensitive, escapeRegex]);

  // Format time for display
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Strip speaker prefix from text (e.g., "[SPEAKER_00] Hello" -> "Hello", "[UNKNOWN] Hello" -> "Hello")
  const stripSpeakerPrefix = useCallback((text: string) => {
    return text.replace(/^\[(SPEAKER_\d+|UNKNOWN)\]\s*/, '');
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
          const entryText = stripSpeakerPrefix(entry.text);

          return (
            <span
              key={index}
              ref={isPlaying ? playingEntryRef : null}
              className={`srt-continuous-entry ${isPlaying ? 'playing' : ''}`}
              onClick={() => handleEntryClick(entry)}
              title={`${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}${speaker ? ` (${speakerNames?.[speaker] || speaker})` : ''}`}
              style={color ? { backgroundColor: `${color}20`, borderRadius: '2px', padding: '2px 4px' } : undefined}
            >
              {searchQuery ? (
                <HighlightedText
                  text={entryText}
                  searchQuery={searchQuery}
                  caseSensitive={caseSensitive}
                  currentMatchGlobalIndex={currentMatchIndex}
                  matchStartIndex={matchStartIndices[index] || 0}
                />
              ) : (
                entryText
              )}
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
        const { speaker, color, isReassigned } = findSpeakerForEntry(entry.startTime, entry.endTime);

        return (
          <div
            key={index}
            className={`srt-entry ${isPlaying ? 'playing' : ''}`}
            onClick={() => handleEntryClick(entry)}
          >
            <div className="srt-entry-header">
              {(speaker || (onSpeakerChange && speakers && speakers.length > 0)) && (
                <span className="srt-speaker-label-wrapper" ref={speakerDropdown?.entryIndex === index ? dropdownRef : undefined}>
                  <span
                    className={`srt-speaker-label ${onSpeakerChange ? 'srt-speaker-label-clickable' : ''} ${isReassigned ? 'srt-speaker-label-reassigned' : ''}`}
                    style={{ backgroundColor: color || '#9CA3AF' }}
                    onClick={onSpeakerChange ? (e) => handleSpeakerLabelClick(e, index, entry, speaker || 'UNKNOWN') : undefined}
                    title={onSpeakerChange ? 'Click to change speaker' : undefined}
                  >
                    {speaker ? (speakerNames?.[speaker] || speaker) : 'Unknown'}
                    {isReassigned && <i className="fas fa-pen srt-speaker-edited-icon"></i>}
                  </span>
                  {speakerDropdown?.entryIndex === index && speakers && (
                    <div className="srt-speaker-dropdown">
                      {speakers.map((s, si) => (
                        <div
                          key={s}
                          className={`srt-speaker-dropdown-item ${s === speaker ? 'active' : ''}`}
                          onClick={(e) => s !== speaker ? handleDropdownSelect(e, s) : e.stopPropagation()}
                        >
                          <span className="speaker-color-dot" style={{ backgroundColor: SPEAKER_COLORS[si % SPEAKER_COLORS.length] }} />
                          <span>{speakerNames?.[s] || s}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </span>
              )}
              <span className="srt-entry-number">#{index + 1}</span>
              <span className="srt-entry-time">
                {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
              </span>
            </div>
            <div className="srt-entry-text">
              {searchQuery ? (
                <HighlightedText
                  text={stripSpeakerPrefix(entry.text)}
                  searchQuery={searchQuery}
                  caseSensitive={caseSensitive}
                  currentMatchGlobalIndex={currentMatchIndex}
                  matchStartIndex={matchStartIndices[index] || 0}
                />
              ) : (
                stripSpeakerPrefix(entry.text)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SRTViewer;