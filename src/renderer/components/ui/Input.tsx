import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  'flex w-full rounded-[var(--radius-md)] border bg-[var(--bg-elevated)] px-3.5 py-2.5 text-[13px] font-[var(--font-body)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus-visible:outline-none focus-visible:border-[var(--teal-500)] focus-visible:shadow-[0_0_0_3px_rgba(0,158,136,0.15)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-[150ms]',
  {
    variants: {
      variant: {
        default: 'border-[var(--border-subtle)]',
        error: 'border-[rgba(232,90,106,0.3)] focus:border-[var(--error)] focus-visible:shadow-[0_0_0_3px_rgba(232,90,106,0.15)]',
        success: 'border-[rgba(60,200,120,0.3)] focus:border-[var(--success)] focus-visible:shadow-[0_0_0_3px_rgba(60,200,120,0.15)]',
      },
      inputSize: {
        default: 'h-10',
        sm: 'h-8 text-[11px] px-3',
        lg: 'h-12 text-[14px] px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'default',
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, inputSize, ...props }, ref) => {
    return (
      <input
        className={inputVariants({ variant, inputSize, className })}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
