import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'ghost' | 'elevated' | 'interactive';
  padding?: 'none' | 'sm' | 'default' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  className = '',
  variant = 'default',
  padding = 'default',
  children,
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'ghost': return 'card-ghost';
      case 'elevated': return 'card-elevated';
      case 'interactive': return 'card-interactive';
      default: return 'card';
    }
  };

  const getPaddingClass = () => {
    switch (padding) {
      case 'none': return '';
      case 'sm': return 'card-sm';
      case 'lg': return 'card-lg';
      default: return '';
    }
  };

  return (
    <div
      className={`${getVariantClass()} ${getPaddingClass()} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`flex flex-col gap-1 ${className}`}
    style={{ paddingBottom: 16 }}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <h3
    className={`text-[13px] font-medium ${className}`}
    style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <p
    className={`text-[11px] ${className}`}
    style={{ color: 'var(--text-muted)' }}
    {...props}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={className} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`flex items-center ${className}`}
    style={{ paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--border-faint)' }}
    {...props}
  >
    {children}
  </div>
);
