'use client';

import { ReactNode } from 'react';

type SectionHeaderProps = {
    title: string;
    description?: string;
    badge?: ReactNode;
    action?: ReactNode;
    className?: string;
};

export function SectionHeader({ title, description, badge, action, className }: SectionHeaderProps) {
    return (
        <div className={['flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className ?? ''].join(' ')}>
            <div className="min-w-0">
                {badge ? <div className="mb-2">{badge}</div> : null}
                <h2 className="type-section-title text-[var(--text-primary)]">{title}</h2>
                {description ? <p className="type-body mt-1 text-[var(--text-muted)]">{description}</p> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}
