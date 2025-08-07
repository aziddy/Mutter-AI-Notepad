import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  overlay?: boolean;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  text,
  overlay = false,
  className = ''
}) => {
  const spinnerClass = `loading-spinner ${size} ${className}`;
  
  const spinnerElement = (
    <div className={spinnerClass}>
      <div className="spinner">
        <i className="fas fa-spinner fa-spin"></i>
      </div>
      {text && <div className="loading-text">{text}</div>}
    </div>
  );

  if (overlay) {
    return (
      <div className="loading-overlay">
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
};

export default LoadingSpinner;