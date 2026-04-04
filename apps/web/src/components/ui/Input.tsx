'use client';

import { clsx } from 'clsx';
import { InputHTMLAttributes, forwardRef, useId } from 'react';
import type React from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    fieldSize?: 'sm' | 'md';
    containerClassName?: string;
    labelClassName?: string;
    helperClassName?: string;
    errorClassName?: string;
}

const InputComponent = (
    {
        className,
        label,
        error,
        helperText,
        id,
        fieldSize = 'md',
        containerClassName,
        labelClassName,
        helperClassName,
        errorClassName,
        ...props
    }: InputProps,
    ref: React.ForwardedRef<HTMLInputElement>
) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={clsx('w-full', containerClassName)}>
            {label && (
                <label
                    htmlFor={inputId}
                    className={clsx('type-caption mb-1.5 block font-medium text-[var(--text-secondary)]', labelClassName)}
                >
                    {label}
                </label>
            )}
            <input
                ref={ref}
                id={inputId}
                className={clsx(
                    'motion-interactive w-full min-h-[44px] rounded-[var(--radius-md)] border px-4 py-3 text-[16px] sm:min-h-[40px] sm:text-sm',
                    'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]',
                    'placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)]',
                    'focus:border-[var(--focus-ring)] focus:outline-none focus:ring-0',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    'read-only:cursor-not-allowed read-only:bg-[color:color-mix(in_srgb,var(--surface-card)_78%,var(--surface-canvas))]',
                    fieldSize === 'sm' && 'min-h-[40px] px-3 py-2 text-sm',
                    error && 'border-[var(--status-danger)] focus:border-[var(--status-danger)]',
                    className
                )}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={describedBy}
                {...props}
            />
            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className={clsx('type-caption mt-1.5 text-[var(--status-danger)]', errorClassName)}
                >
                    {error}
                </p>
            )}
            {helperText && !error && (
                <p id={helperId} className={clsx('type-caption mt-1.5 text-[var(--text-muted)]', helperClassName)}>
                    {helperText}
                </p>
            )}
        </div>
    );
};

export const Input = forwardRef<HTMLInputElement, InputProps>(InputComponent);

Input.displayName = 'Input';
