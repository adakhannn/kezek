'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/Card';

type AdminFormSectionProps = {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
};

export function AdminFormSection({
    title,
    description,
    children,
    className,
    contentClassName,
}: AdminFormSectionProps) {
    return (
        <Card className={clsx('p-5', className)}>
            <div className="mb-4 border-b border-[var(--border-subtle)] pb-3">
                <h3 className="type-section-title text-[var(--text-primary)]">{title}</h3>
                {description ? <p className="type-caption mt-1 text-[var(--text-secondary)]">{description}</p> : null}
            </div>
            <div className={clsx('space-y-4', contentClassName)}>{children}</div>
        </Card>
    );
}

