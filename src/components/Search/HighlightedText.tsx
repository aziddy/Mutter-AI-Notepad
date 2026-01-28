import React, { useMemo } from 'react';

interface HighlightedTextProps {
  text: string;
  searchQuery: string;
  caseSensitive: boolean;
  currentMatchGlobalIndex: number;
  matchStartIndex: number;  // First match index in this text segment
}

// Escape special regex characters
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const HighlightedText: React.FC<HighlightedTextProps> = ({
  text,
  searchQuery,
  caseSensitive,
  currentMatchGlobalIndex,
  matchStartIndex,
}) => {
  const segments = useMemo(() => {
    if (!searchQuery || !text) {
      return [{ type: 'text' as const, content: text, matchIndex: -1 }];
    }

    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`(${escapeRegex(searchQuery)})`, flags);
      const parts = text.split(regex);

      const result: Array<{
        type: 'text' | 'match';
        content: string;
        matchIndex: number;
      }> = [];

      let matchCount = 0;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        // Check if this part matches the search query
        const isMatch = caseSensitive
          ? part === searchQuery
          : part.toLowerCase() === searchQuery.toLowerCase();

        if (isMatch) {
          result.push({
            type: 'match',
            content: part,
            matchIndex: matchStartIndex + matchCount,
          });
          matchCount++;
        } else {
          result.push({
            type: 'text',
            content: part,
            matchIndex: -1,
          });
        }
      }

      return result;
    } catch {
      return [{ type: 'text' as const, content: text, matchIndex: -1 }];
    }
  }, [text, searchQuery, caseSensitive, matchStartIndex]);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>;
        }

        const isCurrent = segment.matchIndex === currentMatchGlobalIndex;

        return (
          <mark
            key={index}
            data-match-index={segment.matchIndex}
            className={`search-highlight ${isCurrent ? 'search-highlight-current' : ''}`}
          >
            {segment.content}
          </mark>
        );
      })}
    </>
  );
};

export default HighlightedText;
