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
        <section className="rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">{title}</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-4 lg:gap-3">
                    {actions.map((action) => (
                        <Link
                            key={action.key}
                            href={action.href}
                            className={`flex flex-col rounded-xl border px-3 py-2 text-xs font-medium shadow-sm transition ${action.className}`}
                        >
                            <span>{action.title}</span>
                            <span className={`mt-0.5 text-[11px] font-normal ${action.hintClassName}`}>{action.hint}</span>
                        </Link>
                    ))}
                </div>
            </div>
            <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-500">{navigationHint}</p>
        </section>
    );
}
