'use client';

import { clsx } from 'clsx';
import { HTMLAttributes } from 'react';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeTone = 'soft' | 'solid' | 'outline';
export type BadgeSize = 'sm' | 'md';

type BadgeStyleOptions = {
    variant?: BadgeVariant;
    tone?: BadgeTone;
    size?: BadgeSize;
    className?: string;
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & BadgeStyleOptions;

const baseStyles =
    'inline-flex items-center gap-1 rounded-full border font-medium tracking-[0.01em] align-middle';

const sizeStyles: Record<BadgeSize, string> = {
    sm: 'px-2 py-0.5 text-[11px]',
    md: 'px-2.5 py-1 text-xs',
};

const variantStyles: Record<BadgeTone, Record<BadgeVariant, string>> = {
    soft: {
        neutral:
            'border-[var(--border-subtle)] bg-[var(--surface-emphasis)] text-[var(--text-secondary)]',
        accent:
            'border-[color:color-mix(in_srgb,var(--accent-primary)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-primary)_12%,transparent)] text-[var(--accent-primary)]',
        success:
            'border-[color:color-mix(in_srgb,var(--status-success)_28%,transparent)] bg-[var(--status-success-soft)] text-[var(--status-success)]',
        warning:
            'border-[color:color-mix(in_srgb,var(--status-warning)_28%,transparent)] bg-[var(--status-warning-soft)] text-[var(--status-warning)]',
        danger:
            'border-[color:color-mix(in_srgb,var(--status-danger)_28%,transparent)] bg-[var(--status-danger-soft)] text-[var(--status-danger)]',
        info: 'border-[color:color-mix(in_srgb,var(--status-info)_28%,transparent)] bg-[var(--status-info-soft)] text-[var(--status-info)]',
    },
    solid: {
        neutral: 'border-transparent bg-[var(--text-primary)] text-[var(--text-inverse)]',
        accent:
            'border-transparent bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-inverse)]',
        success: 'border-transparent bg-[var(--status-success)] text-[var(--text-inverse)]',
        warning: 'border-transparent bg-[var(--status-warning)] text-[var(--text-inverse)]',
        danger: 'border-transparent bg-[var(--status-danger)] text-[var(--text-inverse)]',
        info: 'border-transparent bg-[var(--status-info)] text-[var(--text-inverse)]',
    },
    outline: {
        neutral: 'border-[var(--border-default)] bg-transparent text-[var(--text-secondary)]',
        accent: 'border-[var(--accent-primary)] bg-transparent text-[var(--accent-primary)]',
        success: 'border-[var(--status-success)] bg-transparent text-[var(--status-success)]',
        warning: 'border-[var(--status-warning)] bg-transparent text-[var(--status-warning)]',
        danger: 'border-[var(--status-danger)] bg-transparent text-[var(--status-danger)]',
        info: 'border-[var(--status-info)] bg-transparent text-[var(--status-info)]',
    },
};

export function badgeStyles({
    variant = 'neutral',
    tone = 'soft',
    size = 'md',
    className,
}: BadgeStyleOptions = {}) {
    return clsx(baseStyles, sizeStyles[size], variantStyles[tone][variant], className);
}

export function Badge({
    variant = 'neutral',
    tone = 'soft',
    size = 'md',
    className,
    ...props
}: BadgeProps) {
    return <span className={badgeStyles({ variant, tone, size, className })} {...props} />;
}
