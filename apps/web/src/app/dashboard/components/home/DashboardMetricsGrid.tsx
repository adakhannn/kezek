'use client';

import Link from 'next/link';

import type { DashboardMetricCard } from './types';

type DashboardMetricsGridProps = {
    cards: DashboardMetricCard[];
    ariaLabel: string;
};

export function DashboardMetricsGrid({ cards, ariaLabel }: DashboardMetricsGridProps) {
    if (cards.length === 0) {
        return null;
    }

    return (
        <section aria-label={ariaLabel} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
                <div
                    key={card.key}
                    className={`group flex min-h-[176px] flex-col rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] [background:var(--surface-card)] ${card.borderClassName}`}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="type-label uppercase tracking-[0.08em] [color:var(--text-secondary)]">
                                {card.title}
                            </p>
                            <p className="type-metric mt-2 [color:var(--text-primary)]">{card.value}</p>
                        </div>
                        <div className={`rounded-xl p-2.5 ${card.iconWrapperClassName}`}>{card.icon}</div>
                    </div>
                    {card.hint ? (
                        <p className="type-caption mt-2 [color:var(--text-muted)]">{card.hint}</p>
                    ) : null}
                    <Link
                        href={card.href}
                        className={`type-label mt-auto inline-flex items-center gap-1 pt-4 ${card.linkClassName}`}
                    >
                        {card.actionLabel}
                        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                            -&gt;
                        </span>
                    </Link>
                </div>
            ))}
        </section>
    );
}
