import React, { useEffect, useRef } from 'react';

interface SearchBarProps {
  isOpen: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  currentMatch: number;
  totalMatches: number;
  caseSensitive: boolean;
  onToggleCaseSensitive: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  isOpen,
  searchQuery,
  onSearchChange,
  onClose,
  onNext,
  onPrevious,
  currentMatch,
  totalMatches,
  caseSensitive,
  onToggleCaseSensitive,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const getMatchCountText = () => {
    if (!searchQuery) return '';
    if (totalMatches === 0) return 'No matches';
    return `${currentMatch + 1} of ${totalMatches}`;
  };

  return (
    <div className={`search-bar ${isOpen ? 'visible' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        className="search-input"
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <span className="search-match-count">{getMatchCountText()}</span>

      <button
        className="search-nav-btn"
        onClick={onPrevious}
        disabled={totalMatches === 0}
        title="Previous match (Shift+Enter)"
      >
        <i className="fas fa-chevron-up"></i>
      </button>

      <button
        className="search-nav-btn"
        onClick={onNext}
        disabled={totalMatches === 0}
        title="Next match (Enter)"
      >
        <i className="fas fa-chevron-down"></i>
      </button>

      <button
        className={`search-case-toggle ${caseSensitive ? 'active' : ''}`}
        onClick={onToggleCaseSensitive}
        title="Match case"
      >
        Aa
      </button>

      <button
        className="search-close-btn"
        onClick={onClose}
        title="Close (Escape)"
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default SearchBar;
