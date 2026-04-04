'use client';

import Link from 'next/link';

import type { DashboardQuickAction } from './types';

type DashboardQuickActionsCardProps = {
    actions: DashboardQuickAction[];
    title: string;
    subtitle: string;
    navigationHint: string;
};

export function DashboardQuickActionsCard({
    actions,
    title,
    subtitle,
    navigationHint,
}: DashboardQuickActionsCardProps) {
    return (
        <section className="rounded-2xl border p-4 shadow-sm [background:var(--surface-card)] [border-color:var(--border-default)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="type-section-title [color:var(--text-primary)]">{title}</h2>
                    <p className="type-caption mt-1 [color:var(--text-muted)]">{subtitle}</p>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4 lg:gap-3">
                    {actions.map((action) => (
                        <Link
                            key={action.key}
                            href={action.href}
                            className={`flex flex-col rounded-xl border px-3 py-2 shadow-sm transition ${action.className}`}
                        >
                            <span className="type-label">{action.title}</span>
                            <span className={`type-caption mt-0.5 font-normal ${action.hintClassName}`}>
                                {action.hint}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
            <p className="type-caption mt-3 [color:var(--text-muted)]">{navigationHint}</p>
        </section>
    );
}
