'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type AdminDangerZoneProps = {
    title: string;
    description: string;
    children: ReactNode;
    className?: string;
};

export function AdminDangerZone({ title, description, children, className }: AdminDangerZoneProps) {
    return (
        <section
            className={clsx(
                'rounded-[var(--radius-lg)] border border-[color:color-mix(in_srgb,var(--status-danger)_45%,var(--border-subtle))] bg-[color:color-mix(in_srgb,var(--status-danger)_10%,transparent)] p-5',
                className,
            )}
        >
            <h3 className="type-section-title text-[color:color-mix(in_srgb,var(--status-danger)_90%,white)]">{title}</h3>
            <p className="type-caption mt-1 text-[color:color-mix(in_srgb,var(--status-danger)_82%,white)]">{description}</p>
            <div className="mt-4">{children}</div>
        </section>
    );
}

