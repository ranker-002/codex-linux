import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: boolean;
  inputSize?: 'default' | 'sm' | 'lg';
}

export const Input: React.FC<InputProps> = ({
  className = '',
  label,
  hint,
  error = false,
  inputSize = 'default',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const getSizeClass = () => {
    switch (inputSize) {
      case 'sm': return 'input-sm';
      case 'lg': return 'input-lg';
      default: return '';
    }
  };

  return (
    <div className="input-wrap">
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`input ${error ? 'error' : ''} ${getSizeClass()} ${className}`}
        {...props}
      />
      {hint && !error && (
        <span className="input-hint">{hint}</span>
      )}
      {error && hint && (
        <span className="input-hint" style={{ color: 'var(--error)' }}>{hint}</span>
      )}
    </div>
  );
};
