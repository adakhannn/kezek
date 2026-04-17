'use client';

import Link from 'next/link';

import type { DashboardMetricCard } from './types';

type DashboardMetricsGridProps = {
    cards: DashboardMetricCard[];
};

export function DashboardMetricsGrid({ cards }: DashboardMetricsGridProps) {
    const [primaryCard, ...secondaryCards] = cards;

    if (!primaryCard) {
        return null;
    }

    return (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)]">
            <div
                className={`group rounded-[28px] border p-5 shadow-[var(--shadow-md)] transition hover:-translate-y-0.5 hover:shadow-lg [background:var(--surface-card)] ${primaryCard.borderClassName}`}
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="type-label uppercase tracking-[0.08em] [color:var(--text-secondary)]">
                            {primaryCard.title}
                        </p>
                        <p className="type-metric mt-2 text-[3rem] leading-none [color:var(--text-primary)]">
                            {primaryCard.value}
                        </p>
                        {primaryCard.hint ? (
                            <p className="type-body mt-2 max-w-[24rem] [color:var(--text-muted)]">{primaryCard.hint}</p>
                        ) : null}
                    </div>
                    <div className={`rounded-2xl p-3 ${primaryCard.iconWrapperClassName}`}>{primaryCard.icon}</div>
                </div>
                <Link
                    href={primaryCard.href}
                    className={`type-label mt-6 inline-flex items-center gap-2 ${primaryCard.linkClassName}`}
                >
                    {primaryCard.actionLabel}
                    <span aria-hidden="true">-&gt;</span>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {secondaryCards.map((card) => (
                    <div
                        key={card.key}
                        className={`group rounded-[24px] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md [background:var(--surface-card)] ${card.borderClassName}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="type-label uppercase tracking-[0.08em] [color:var(--text-secondary)]">
                                    {card.title}
                                </p>
                                <p className="type-metric mt-2 [color:var(--text-primary)]">{card.value}</p>
                                {card.hint ? (
                                    <p className="type-caption mt-2 [color:var(--text-muted)]">{card.hint}</p>
                                ) : null}
                            </div>
                            <div className={`rounded-full p-2 ${card.iconWrapperClassName}`}>{card.icon}</div>
                        </div>
                        <Link
                            href={card.href}
                            className={`type-label mt-4 inline-flex items-center gap-1 ${card.linkClassName}`}
                        >
                            {card.actionLabel}
                            <span aria-hidden="true">-&gt;</span>
                        </Link>
                    </div>
                ))}
            </div>
        </section>
    );
}
