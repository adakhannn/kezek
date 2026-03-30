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
                    className={`group rounded-2xl border bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900/80 ${card.borderClassName}`}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide">{card.title}</p>
                            <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-50">{card.value}</p>
                            {card.hint ? (
                                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{card.hint}</p>
                            ) : null}
                        </div>
                        <div className={`rounded-full p-2 ${card.iconWrapperClassName}`}>{card.icon}</div>
                    </div>
                    <Link
                        href={card.href}
                        className={`mt-3 inline-flex items-center text-xs font-medium ${card.linkClassName}`}
                    >
                        {card.actionLabel}
                        <span className="ml-1">→</span>
                    </Link>
                </div>
            ))}
        </section>
    );
}
