import React, { useCallback } from 'react';

interface AIResultsProps {
  title: string;
  content: string;
  visible: boolean;
  isStreaming?: boolean;
  onCancel?: () => void;
}

const AIResults: React.FC<AIResultsProps> = ({
  title,
  content,
  visible,
  isStreaming = false,
  onCancel,
}) => {
  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  if (!visible) {
    return null;
  }

  // Enhanced markdown parser
  const parseMarkdown = (text: string) => {
    if (!text) return '';
    
    let html = text;
    
    // Handle code blocks first (before other processing)
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Handle tables
    html = html.replace(/^\|(.+)\|$/gm, (_match, content) => {
      // Check if this is a header separator line (contains only -, |, :, spaces)
      if (content.match(/^[\s\-\|\:]+$/)) {
        return ''; // Remove separator lines
      }

      const cells = content.split('|').map((cell: string) => cell.trim());
      const cellTags = cells.map((cell: string) => `<td>${cell}</td>`).join('');
      return `<tr>${cellTags}</tr>`;
    });
    
    // Wrap table rows in table element
    html = html.replace(/(<tr>.*?<\/tr>(?:\s*<tr>.*?<\/tr>)*)/gs, '<table class="markdown-table">$1</table>');
    
    // Handle headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Handle bold and italic (be careful with order)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    
    // Handle inline code (avoid code within pre blocks)
    html = html.replace(/`([^`]+?)`/g, (_, code) => {
      return `<code>${code}</code>`;
    });
    
    // Handle block quotes
    html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // Handle bullet point lists (using • character)
    html = html.replace(/^((?:• .+(?:\n|$))+)/gm, (match) => {
      const listItems = match.trim().split('\n').map(line => {
        return line.replace(/^• /, '<li>') + '</li>';
      }).join('');
      return `<ul>${listItems}</ul>`;
    });
    
    // Handle unordered lists (traditional markdown)
    html = html.replace(/^((?:[\*\-\+] .+(?:\n|$))+)/gm, (match) => {
      const listItems = match.trim().split('\n').map(line => {
        return line.replace(/^[\*\-\+] /, '<li>') + '</li>';
      }).join('');
      return `<ul>${listItems}</ul>`;
    });
    
    // Handle ordered lists
    html = html.replace(/^((?:\d+\. .+(?:\n|$))+)/gm, (match) => {
      const listItems = match.trim().split('\n').map(line => {
        return line.replace(/^\d+\. /, '<li>') + '</li>';
      }).join('');
      return `<ol>${listItems}</ol>`;
    });
    
    // Handle line breaks and paragraphs more carefully
    const paragraphs = html.split(/\n\s*\n/);
    html = paragraphs.map(para => {
      para = para.trim();
      if (!para) return '';
      
      // Don't wrap if it's already an HTML element
      if (para.match(/^<(h[1-6]|ul|ol|blockquote|pre|li|table|tr|td)/i)) {
        return para;
      }
      
      // Replace single line breaks with <br> within paragraphs
      const processedPara = para.replace(/\n/g, '<br />');
      return `<p>${processedPara}</p>`;
    }).filter(p => p).join('\n\n');
    
    // Clean up extra whitespace and empty elements
    html = html.replace(/\n\s*\n\s*\n/g, '\n\n');
    html = html.replace(/<p>\s*<\/p>/g, '');
    
    return html;
  };

  return (
    <div className="ai-results">
      <div className="ai-results-header">
        <h4>{title}</h4>
        {isStreaming && onCancel && (
          <button
            className="cancel-stream-btn"
            onClick={handleCancel}
            title="Cancel generation"
          >
            <i className="fas fa-times"></i> Cancel
          </button>
        )}
      </div>
      <div
        className="ai-results-content"
        dangerouslySetInnerHTML={{
          __html: parseMarkdown(content) + (isStreaming ? '<span class="streaming-indicator">▋</span>' : '')
        }}
      />
    </div>
  );
};

export default AIResults;