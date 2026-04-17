'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/Card';

type AdminFilterBarProps = {
    title?: string;
    description?: string;
    children: ReactNode;
    actions?: ReactNode;
    className?: string;
};

export function AdminFilterBar({ title, description, children, actions, className }: AdminFilterBarProps) {
    return (
        <Card className={clsx('p-4', className)}>
            {(title || description || actions) && (
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        {title ? <h3 className="type-section-title text-[var(--text-primary)]">{title}</h3> : null}
                        {description ? <p className="type-caption mt-1 text-[var(--text-secondary)]">{description}</p> : null}
                    </div>
                    {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
                </div>
            )}
            {children}
        </Card>
    );
}

