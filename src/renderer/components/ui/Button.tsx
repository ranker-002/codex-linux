import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] font-medium transition-all duration-[180ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal-400)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer border-none',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--teal-500)] text-[var(--bg-void)] hover:bg-[var(--teal-400)] active:scale-[0.98] font-medium',
        secondary: 'bg-transparent text-[var(--teal-400)] border border-[var(--border-accent)] hover:bg-[rgba(0,200,168,0.06)] active:scale-[0.98]',
        ghost: 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-[0.98]',
        danger: 'bg-[rgba(232,90,106,0.1)] text-[var(--error)] border border-[rgba(232,90,106,0.2)] hover:bg-[rgba(232,90,106,0.15)]',
        outline: 'bg-transparent text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-accent)] hover:text-[var(--teal-400)]',
        icon: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] hover:text-[var(--teal-400)]',
      },
      size: {
        default: 'h-10 px-4.5 py-2 text-[13px]',
        sm: 'h-8 px-3 text-[11px] rounded-[var(--radius-sm)]',
        lg: 'h-12 px-6 text-[14px]',
        icon: 'h-10 w-10 p-2',
        'icon-sm': 'h-8 w-8 p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  asChild?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaPressed?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ariaLabel, ariaDescribedBy, ariaExpanded, ariaPressed, ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-expanded={ariaExpanded}
        aria-pressed={ariaPressed}
        {...props}
      >
        {loading && (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
