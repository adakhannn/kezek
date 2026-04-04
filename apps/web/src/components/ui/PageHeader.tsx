'use client';

import { ReactNode } from 'react';

type PageHeaderProps = {
    eyebrow?: ReactNode;
    title: string;
    description?: string;
    meta?: ReactNode;
    actions?: ReactNode;
    className?: string;
};

export function PageHeader({ eyebrow, title, description, meta, actions, className }: PageHeaderProps) {
    return (
        <header className={['flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className ?? ''].join(' ')}>
            <div className="min-w-0">
                {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
                <h1 className="type-page-title text-[var(--text-primary)]">{title}</h1>
                {description ? <p className="type-body mt-2 max-w-3xl text-[var(--text-muted)]">{description}</p> : null}
                {meta ? <div className="mt-3">{meta}</div> : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
    );
}
