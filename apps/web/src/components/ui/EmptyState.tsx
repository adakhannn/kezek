'use client';

import { ReactNode } from 'react';

import { Card } from './Card';

type EmptyStateProps = {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    secondaryAction?: ReactNode;
    compact?: boolean;
    className?: string;
};

const defaultIcon = (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
);

export function EmptyState({
    icon = defaultIcon,
    title,
    description,
    action,
    secondaryAction,
    compact = false,
    className,
}: EmptyStateProps) {
    return (
        <Card
            variant="elevated"
            padding={compact ? 'md' : 'lg'}
            className={[
                'text-center',
                compact ? 'p-6' : 'p-10 sm:p-12',
                className ?? '',
            ].join(' ')}
        >
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-emphasis)] text-[var(--text-muted)]">
                {icon}
            </div>
            <h3 className="type-section-title text-[var(--text-primary)]">{title}</h3>
            {description ? <p className="type-body mx-auto mt-2 max-w-[40rem] text-[var(--text-muted)]">{description}</p> : null}
            {action || secondaryAction ? (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    {action}
                    {secondaryAction}
                </div>
            ) : null}
        </Card>
    );
}
