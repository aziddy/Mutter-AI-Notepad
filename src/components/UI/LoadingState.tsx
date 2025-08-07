import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface LoadingStateProps {
  loading: boolean;
  error?: string | null;
  children: React.ReactNode;
  loadingText?: string;
  emptyState?: {
    icon?: string;
    title: string;
    description?: string;
    action?: {
      text: string;
      onClick: () => void;
    };
  };
  isEmpty?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  loading,
  error,
  children,
  loadingText = 'Loading...',
  emptyState,
  isEmpty = false
}) => {
  if (loading) {
    return <LoadingSpinner text={loadingText} />;
  }

  if (error) {
    return (
      <div className="error-state">
        <div className="error-icon">
          <i className="fas fa-exclamation-circle"></i>
        </div>
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (isEmpty && emptyState) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <i className={`fas ${emptyState.icon || 'fa-inbox'}`}></i>
        </div>
        <h3>{emptyState.title}</h3>
        {emptyState.description && <p>{emptyState.description}</p>}
        {emptyState.action && (
          <button 
            className="btn btn-primary" 
            onClick={emptyState.action.onClick}
          >
            {emptyState.action.text}
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
};

export default LoadingState;