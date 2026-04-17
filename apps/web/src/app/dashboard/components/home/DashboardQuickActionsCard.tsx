'use client';

import Link from 'next/link';

import type { DashboardHomeFocus, DashboardQuickAction } from './types';

type DashboardQuickActionsCardProps = {
    actions: DashboardQuickAction[];
    focus: DashboardHomeFocus;
    title: string;
    subtitle: string;
    navigationHint: string;
    priorityLabel: string;
};

const focusToneClasses: Record<DashboardHomeFocus['tone'], string> = {
    warning:
        'border-amber-200 bg-amber-50/85 text-amber-950 dark:border-amber-800/70 dark:bg-amber-950/30 dark:text-amber-50',
    info: 'border-indigo-200 bg-indigo-50/85 text-indigo-950 dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-50',
    success:
        'border-emerald-200 bg-emerald-50/85 text-emerald-950 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-50',
};

export function DashboardQuickActionsCard({
    actions,
    focus,
    title,
    subtitle,
    navigationHint,
    priorityLabel,
}: DashboardQuickActionsCardProps) {
    return (
        <section className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-md)] sm:p-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
                <div className={`rounded-[24px] border p-4 shadow-sm ${focusToneClasses[focus.tone]}`}>
                    <p className="type-label uppercase tracking-[0.08em] opacity-80">{priorityLabel}</p>
                    <h2 className="type-section-title mt-2">{focus.title}</h2>
                    <p className="type-body mt-2 max-w-[32rem] opacity-85">{focus.description}</p>
                    <Link
                        href={focus.href}
                        className="type-label mt-4 inline-flex items-center gap-2 rounded-full border border-current/15 bg-white/60 px-4 py-2 text-current transition hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                        {focus.ctaLabel}
                        <span aria-hidden="true">-&gt;</span>
                    </Link>
                </div>

                <div className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h3 className="type-section-title [color:var(--text-primary)]">{title}</h3>
                            <p className="type-caption mt-1 max-w-[40rem] [color:var(--text-muted)]">{subtitle}</p>
                        </div>
                        <p className="type-caption max-w-[18rem] [color:var(--text-secondary)] sm:text-right">{navigationHint}</p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {actions.map((action, index) => (
                            <Link
                                key={action.key}
                                href={action.href}
                                className={`group flex min-h-[132px] flex-col rounded-[22px] border px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${action.className}`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="type-label uppercase tracking-[0.08em] opacity-80">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <span className="type-label rounded-full border border-current/10 px-2 py-1 text-[11px] opacity-90">
                                        {action.emphasis}
                                    </span>
                                </div>
                                <span className="type-section-title mt-4">{action.title}</span>
                                <span className={`type-caption mt-2 max-w-[22rem] ${action.hintClassName}`}>{action.hint}</span>
                                <span className="type-label mt-auto inline-flex items-center gap-1 pt-4 opacity-90">
                                    Перейти
                                    <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                                        -&gt;
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
