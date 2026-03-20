import type { ReactNode } from 'react';
import Link from 'next/link';

export function AdminMetricCard({
    title,
    value,
    href,
    hint,
    icon,
    gradient,
}: {
    title: string;
    value: number | string;
    href?: string;
    hint?: string;
    icon: ReactNode;
    gradient: string;
}) {
    const inner = (
        <div
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1`}
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <div className="opacity-90">{icon}</div>
                    {hint && <span className="text-xs opacity-75 bg-white/20 px-2 py-1 rounded-full">{hint}</span>}
                </div>
                <div className="text-sm font-medium opacity-90 mb-1">{title}</div>
                <div className="text-3xl font-bold">{value.toLocaleString('ru-RU')}</div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
        </div>
    );

    return href ? (
        <Link href={href} className="block">
            {inner}
        </Link>
    ) : (
        inner
    );
}
