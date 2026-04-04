'use client';

import type { ReactNode } from 'react';

import { AlertBanner, type AlertBannerVariant } from '@/components/ui/AlertBanner';

type EmptyStateType = 'error' | 'warning' | 'info' | 'empty' | 'loading';

type EmptyStateProps = {
    type: EmptyStateType;
    title?: string;
    message: string;
    hint?: string;
    icon?: ReactNode;
    action?: ReactNode;
};

const variantMap: Record<Exclude<EmptyStateType, 'loading'>, AlertBannerVariant> = {
    error: 'danger',
    warning: 'warning',
    info: 'info',
    empty: 'info',
};

export function BookingEmptyState({ type, title, message, hint, icon, action }: EmptyStateProps) {
    if (type === 'loading') {
        return (
            <div className="rounded-[22px] border border-dashed border-[var(--border-default)] bg-[var(--surface-emphasis)] p-4">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent-primary)] border-t-transparent" />
                    <div className="min-w-0">
                        <div className="type-label text-[var(--text-primary)]">{title ?? message}</div>
                        {hint ? <p className="type-caption mt-1 text-[var(--text-secondary)]">{hint}</p> : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <AlertBanner
            variant={variantMap[type]}
            icon={icon}
            title={title ?? message}
            message={title && hint ? hint : title ? message : hint ?? ''}
            action={action}
            compact
            className={
                type === 'empty'
                    ? 'border-[var(--border-default)] bg-[var(--surface-emphasis)] text-[var(--text-muted)]'
                    : undefined
            }
        />
    );
}
