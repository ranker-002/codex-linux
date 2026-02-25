import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  className = '',
  variant = 'primary',
  size = 'default',
  loading = false,
  disabled = false,
  children,
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'primary': return 'btn-primary';
      case 'secondary': return 'btn-secondary';
      case 'ghost': return 'btn-ghost';
      case 'danger': return 'btn-danger';
      default: return 'btn-primary';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'btn-sm';
      case 'lg': return 'btn-lg';
      case 'icon': return 'btn-icon';
      default: return '';
    }
  };

  return (
    <button
      className={`btn ${getVariantClass()} ${getSizeClass()} ${loading ? 'btn-loading' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />}
      {children}
    </button>
  );
};
