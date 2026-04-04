'use client';

import Link from 'next/link';

import type { DashboardMetricCard } from './types';

type DashboardMetricsGridProps = {
    cards: DashboardMetricCard[];
};

export function DashboardMetricsGrid({ cards }: DashboardMetricsGridProps) {
    return (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
                <div
                    key={card.key}
                    className={`group rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md [background:var(--surface-card)] ${card.borderClassName}`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="type-label uppercase tracking-[0.08em] [color:var(--text-secondary)]">
                                {card.title}
                            </p>
                            <p className="type-metric mt-1 [color:var(--text-primary)]">{card.value}</p>
                            {card.hint ? (
                                <p className="type-caption mt-1 [color:var(--text-muted)]">{card.hint}</p>
                            ) : null}
                        </div>
                        <div className={`rounded-full p-2 ${card.iconWrapperClassName}`}>{card.icon}</div>
                    </div>
                    <Link href={card.href} className={`type-label mt-3 inline-flex items-center ${card.linkClassName}`}>
                        {card.actionLabel}
                        <span className="ml-1">-&gt;</span>
                    </Link>
                </div>
            ))}
        </section>
    );
}
