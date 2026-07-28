'use client';

import { clsx } from 'clsx';
import { SelectHTMLAttributes, forwardRef, useId } from 'react';
import type React from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    helperText?: string;
    containerClassName?: string;
    labelClassName?: string;
}

const SelectComponent = (
    {
        children,
        className,
        containerClassName,
        error,
        helperText,
        id,
        label,
        labelClassName,
        ...props
    }: SelectProps,
    ref: React.ForwardedRef<HTMLSelectElement>,
) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText && !error ? `${selectId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={clsx('w-full', containerClassName)}>
            {label ? (
                <label
                    htmlFor={selectId}
                    className={clsx(
                        'type-caption mb-1.5 block font-medium text-[var(--text-secondary)]',
                        labelClassName,
                    )}
                >
                    {label}
                </label>
            ) : null}
            <div className="relative">
                <select
                    ref={ref}
                    id={selectId}
                    className={clsx(
                        'motion-interactive min-h-[44px] w-full appearance-none rounded-[var(--radius-md)] border px-4 py-3 pr-11 text-[16px] sm:min-h-[40px] sm:text-sm',
                        'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]',
                        'hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:outline-none focus:ring-0',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        error && 'border-[var(--status-danger)] focus:border-[var(--status-danger)]',
                        className,
                    )}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={describedBy}
                    {...props}
                >
                    {children}
                </select>
                <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
                >
                    <path
                        d="m6 8 4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            {error ? (
                <p id={errorId} role="alert" className="type-caption mt-1.5 text-[var(--status-danger)]">
                    {error}
                </p>
            ) : null}
            {helperText && !error ? (
                <p id={helperId} className="type-caption mt-1.5 text-[var(--text-muted)]">
                    {helperText}
                </p>
            ) : null}
        </div>
    );
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(SelectComponent);

Select.displayName = 'Select';
