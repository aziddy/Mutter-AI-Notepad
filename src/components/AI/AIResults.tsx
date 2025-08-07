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
    let html = text;
    
    // Handle code blocks first (before other processing)
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Handle headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Handle bold and italic (be careful with order)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(?<!\*)\*(?!\*)([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    
    // Handle inline code
    html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
    
    // Handle block quotes
    html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // Handle unordered lists - more robust approach
    html = html.replace(/^([\*\-\+] .*$(?:\n[\*\-\+] .*$)*)/gm, (match) => {
      const listItems = match.replace(/^[\*\-\+] /gm, '<li>').replace(/$/gm, '</li>');
      return `<ul>${listItems}</ul>`;
    });
    
    // Handle ordered lists - more robust approach  
    html = html.replace(/^(\d+\. .*$(?:\n\d+\. .*$)*)/gm, (match) => {
      const listItems = match.replace(/^\d+\. /gm, '<li>').replace(/$/gm, '</li>');
      return `<ol>${listItems}</ol>`;
    });
    
    // Handle line breaks and paragraphs
    // Split by double line breaks for paragraphs
    const paragraphs = html.split(/\n\s*\n/);
    html = paragraphs.map(para => {
      // Don't wrap if it's already an HTML element
      if (para.match(/^<(h[1-6]|ul|ol|blockquote|pre)/)) {
        return para;
      }
      // Replace single line breaks with <br> within paragraphs
      return '<p>' + para.replace(/\n/g, '<br />') + '</p>';
    }).join('\n');
    
    // Clean up any extra whitespace
    html = html.replace(/\n\s*\n/g, '\n');
    
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