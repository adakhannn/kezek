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
    actionLabel: string;
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
    actionLabel,
}: DashboardQuickActionsCardProps) {
    return (
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-md)] sm:p-5">
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
                <div className={`self-start rounded-2xl border p-5 shadow-sm ${focusToneClasses[focus.tone]}`}>
                    <p className="type-label uppercase tracking-[0.08em] opacity-80">{priorityLabel}</p>
                    <h2 className="type-section-title mt-2">{focus.title}</h2>
                    <p className="type-body mt-2 max-w-[32rem] opacity-85">{focus.description}</p>
                    <Link
                        href={focus.href}
                        className="type-label mt-5 inline-flex items-center gap-2 rounded-lg border border-current/15 bg-black/5 px-4 py-2.5 text-current transition hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"
                    >
                        {focus.ctaLabel}
                        <span aria-hidden="true">-&gt;</span>
                    </Link>
                </div>

                <div className="min-w-0">
                    <div>
                        <h3 className="type-section-title [color:var(--text-primary)]">{title}</h3>
                        <p className="type-caption mt-1 max-w-[44rem] [color:var(--text-muted)]">{subtitle}</p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {actions.map((action, index) => (
                            <Link
                                key={action.key}
                                href={action.href}
                                className={`group flex min-h-[128px] flex-col rounded-2xl border px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${action.className}`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="type-label uppercase tracking-[0.08em] opacity-80">
                                        {String(index + 1).padStart(2, '0')}
                                    </span>
                                    <span className="type-label rounded-full border border-current/10 px-2 py-1 text-[11px] opacity-90">
                                        {action.emphasis}
                                    </span>
                                </div>
                                <span className="type-section-title mt-3">{action.title}</span>
                                <span className={`type-caption mt-2 max-w-[22rem] ${action.hintClassName}`}>{action.hint}</span>
                                <span className="type-label mt-auto inline-flex items-center gap-1 pt-4 opacity-90">
                                    {actionLabel}
                                    <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                                        -&gt;
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                    <p className="type-caption mt-3 [color:var(--text-muted)]">{navigationHint}</p>
                </div>
            </div>
        </section>
    );
}
