import { useState, useCallback, useMemo, useEffect } from 'react';

interface SearchMatch {
  index: number;      // Global match index
  position: number;   // Character position in text
  length: number;     // Match length
}

interface UseTextSearchReturn {
  // State
  isSearchOpen: boolean;
  searchQuery: string;
  matches: SearchMatch[];
  currentMatchIndex: number;
  caseSensitive: boolean;
  totalMatches: number;

  // Actions
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  toggleCaseSensitivity: () => void;
  goToNextMatch: () => void;
  goToPreviousMatch: () => void;
  goToMatch: (index: number) => void;

  // Helpers
  isCurrentMatch: (matchIndex: number) => boolean;
}

// Escape special regex characters
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export function useTextSearch(text: string): UseTextSearchReturn {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQueryState] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);

  // Compute matches when query, text, or caseSensitive changes
  const matches = useMemo<SearchMatch[]>(() => {
    if (!searchQuery || !text) return [];

    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(escapeRegex(searchQuery), flags);
      const results: SearchMatch[] = [];
      let match: RegExpExecArray | null;
      let index = 0;

      while ((match = regex.exec(text)) !== null) {
        results.push({
          index,
          position: match.index,
          length: match[0].length,
        });
        index++;
      }

      return results;
    } catch {
      return [];
    }
  }, [searchQuery, text, caseSensitive]);

  const totalMatches = matches.length;

  // Reset current match index when matches change
  useEffect(() => {
    if (currentMatchIndex >= totalMatches) {
      setCurrentMatchIndex(totalMatches > 0 ? 0 : 0);
    }
  }, [totalMatches, currentMatchIndex]);

  // Reset search state when text changes significantly (e.g., switching transcriptions)
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [text]);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQueryState('');
    setCurrentMatchIndex(0);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    setCurrentMatchIndex(0);
  }, []);

  const toggleCaseSensitivity = useCallback(() => {
    setCaseSensitive(prev => !prev);
    setCurrentMatchIndex(0);
  }, []);

  const goToNextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex(prev => (prev + 1) % totalMatches);
  }, [totalMatches]);

  const goToPreviousMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex(prev => (prev - 1 + totalMatches) % totalMatches);
  }, [totalMatches]);

  const goToMatch = useCallback((index: number) => {
    if (index >= 0 && index < totalMatches) {
      setCurrentMatchIndex(index);
    }
  }, [totalMatches]);

  const isCurrentMatch = useCallback((matchIndex: number) => {
    return matchIndex === currentMatchIndex;
  }, [currentMatchIndex]);

  // Keyboard event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F or Cmd+F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        openSearch();
        return;
      }

      // Only handle other shortcuts when search is open
      if (!isSearchOpen) return;

      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
        return;
      }

      // Enter for next match, Shift+Enter for previous
      // Only when the search input is focused
      const activeElement = document.activeElement;
      const isSearchInputFocused = activeElement?.classList.contains('search-input');

      if (e.key === 'Enter' && isSearchInputFocused) {
        e.preventDefault();
        if (e.shiftKey) {
          goToPreviousMatch();
        } else {
          goToNextMatch();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, openSearch, closeSearch, goToNextMatch, goToPreviousMatch]);

  return {
    isSearchOpen,
    searchQuery,
    matches,
    currentMatchIndex,
    caseSensitive,
    totalMatches,
    openSearch,
    closeSearch,
    setSearchQuery,
    toggleCaseSensitivity,
    goToNextMatch,
    goToPreviousMatch,
    goToMatch,
    isCurrentMatch,
  };
}
