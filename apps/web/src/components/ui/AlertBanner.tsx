'use client';

import { clsx } from 'clsx';
import { ReactNode } from 'react';

export type AlertBannerVariant = 'info' | 'success' | 'warning' | 'danger';

type AlertBannerProps = {
    variant?: AlertBannerVariant;
    title?: string;
    message: string;
    icon?: ReactNode;
    action?: ReactNode;
    onClose?: () => void;
    compact?: boolean;
    className?: string;
};

const variantStyles: Record<AlertBannerVariant, string> = {
    info: 'border-[color:color-mix(in_srgb,var(--status-info)_24%,transparent)] bg-[var(--status-info-soft)] text-[var(--status-info)]',
    success:
        'border-[color:color-mix(in_srgb,var(--status-success)_24%,transparent)] bg-[var(--status-success-soft)] text-[var(--status-success)]',
    warning:
        'border-[color:color-mix(in_srgb,var(--status-warning)_24%,transparent)] bg-[var(--status-warning-soft)] text-[var(--status-warning)]',
    danger:
        'border-[color:color-mix(in_srgb,var(--status-danger)_24%,transparent)] bg-[var(--status-danger-soft)] text-[var(--status-danger)]',
};

const defaultIcons: Record<AlertBannerVariant, ReactNode> = {
    info: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    success: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
    ),
    warning: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    ),
    danger: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
};

export function AlertBanner({
    variant = 'info',
    title,
    message,
    icon,
    action,
    onClose,
    compact = false,
    className,
}: AlertBannerProps) {
    return (
        <div
            role={variant === 'danger' ? 'alert' : 'status'}
            className={clsx(
                'rounded-[var(--radius-lg)] border',
                compact ? 'px-3 py-2' : 'px-4 py-3',
                variantStyles[variant],
                className,
            )}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0" aria-hidden="true">
                    {icon ?? defaultIcons[variant]}
                </div>
                <div className="min-w-0 flex-1">
                    {title ? <p className="type-label">{title}</p> : null}
                    <p className={clsx(title ? 'type-caption mt-1 opacity-95' : 'type-body')}>{message}</p>
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
                {onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        className="motion-interactive shrink-0 opacity-70 hover:opacity-100"
                        aria-label="Close banner"
                    >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                ) : null}
            </div>
        </div>
    );
}
