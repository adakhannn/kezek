'use client';

import { useEffect, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';

type FunnelStep = {
    step: string;
    stepName: string;
    uniqueSessions: number;
    totalEvents: number;
    conversionRate: number;
};

type FunnelAnalyticsData = {
    funnel: FunnelStep[];
    summary: {
        totalViews: number;
        totalBookings: number;
        overallConversionRate: number;
        totalEvents: number;
    };
};

type FunnelAnalyticsResponse = {
    ok: boolean;
    data: FunnelAnalyticsData;
    error?: string;
};

export default function FunnelAnalyticsClient() {
    const [data, setData] = useState<FunnelAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        source: '' as 'public' | 'quickdesk' | '',
    });

    const loadAnalytics = async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams();
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);
            if (filters.source) params.set('source', filters.source);

            const response = await fetch(`/api/admin/funnel-analytics?${params.toString()}`, {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result: FunnelAnalyticsResponse = await response.json();

            if (!result.ok || !result.data) {
                throw new Error(result.error || 'Failed to load funnel analytics');
            }

            setData(result.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, [filters]);

    const getConversionColor = (rate: number) => {
        if (rate >= 50) return 'text-emerald-600 dark:text-emerald-400';
        if (rate >= 30) return 'text-blue-600 dark:text-blue-400';
        if (rate >= 10) return 'text-amber-600 dark:text-amber-400';
        return 'text-red-600 dark:text-red-400';
    };

    return (
        <div className="container mx-auto space-y-6 px-4 py-8">
            <PageHeader
                title="РђРЅР°Р»РёС‚РёРєР° РІРѕСЂРѕРЅРєРё"
                description="РљРѕРЅРІРµСЂСЃРёСЏ РјРµР¶РґСѓ С€Р°РіР°РјРё РїСЂРѕС†РµСЃСЃР° Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ"
                actions={
                    <Button type="button" variant="secondary" onClick={loadAnalytics} isLoading={loading}>
                        РћР±РЅРѕРІРёС‚СЊ
                    </Button>
                }
            />

            <section className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6">
                <SectionHeader
                    title="Р¤РёР»СЊС‚СЂС‹"
                    description="РћС‚СЃРµР№С‚Рµ РїРµСЂРёРѕРґ Рё РёСЃС‚РѕС‡РЅРёРє, С‡С‚РѕР±С‹ СЃСЂР°РІРЅРёРІР°С‚СЊ РєРѕРЅРІРµСЂСЃРёСЋ РјРµР¶РґСѓ РїСѓР±Р»РёС‡РЅС‹Рј РїРѕС‚РѕРєРѕРј Рё QuickDesk."
                    className="mb-4"
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <label className="type-label mb-1 block text-[var(--text-secondary)]">Р”Р°С‚Р° РЅР°С‡Р°Р»Р°</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        />
                    </div>
                    <div>
                        <label className="type-label mb-1 block text-[var(--text-secondary)]">Р”Р°С‚Р° РѕРєРѕРЅС‡Р°РЅРёСЏ</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        />
                    </div>
                    <div>
                        <label className="type-label mb-1 block text-[var(--text-secondary)]">РСЃС‚РѕС‡РЅРёРє</label>
                        <select
                            value={filters.source}
                            onChange={(e) => setFilters({ ...filters, source: e.target.value as 'public' | 'quickdesk' | '' })}
                            className="min-h-[44px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        >
                            <option value="">Р’СЃРµ</option>
                            <option value="public">РџСѓР±Р»РёС‡РЅС‹Р№ РїРѕС‚РѕРє</option>
                            <option value="quickdesk">QuickDesk</option>
                        </select>
                    </div>
                </div>
            </section>

            {error ? (
                <AlertBanner
                    variant="danger"
                    title="РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё"
                    message={error}
                    action={
                        <Button type="button" size="sm" variant="danger" onClick={loadAnalytics}>
                            РџРѕРїСЂРѕР±РѕРІР°С‚СЊ СЃРЅРѕРІР°
                        </Button>
                    }
                />
            ) : null}

            {loading && !data ? (
                <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 py-12 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--accent-primary)]" />
                    <p className="type-body mt-4 text-[var(--text-secondary)]">Р—Р°РіСЂСѓР·РєР° Р°РЅР°Р»РёС‚РёРєРё РІРѕСЂРѕРЅРєРё...</p>
                </div>
            ) : null}

            {!loading && !error && data && data.funnel.length === 0 ? (
                <EmptyState
                    title="РќРµС‚ РґР°РЅРЅС‹С… РІРѕСЂРѕРЅРєРё"
                    description="Р—Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ Рё С„РёР»СЊС‚СЂС‹ РїРѕРєР° РЅРµС‚ СЃРѕР±С‹С‚РёР№ РґР»СЏ Р°РЅР°Р»РёР·Р°."
                    action={
                        <Button type="button" variant="secondary" onClick={loadAnalytics}>
                            РћР±РЅРѕРІРёС‚СЊ
                        </Button>
                    }
                />
            ) : null}

            {data ? (
                <>
                    <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <SummaryCard label="Р’СЃРµРіРѕ РїСЂРѕСЃРјРѕС‚СЂРѕРІ" value={data.summary.totalViews} />
                        <SummaryCard label="РЈСЃРїРµС€РЅС‹С… Р±СЂРѕРЅРµР№" value={data.summary.totalBookings} />
                        <SummaryCard
                            label="РћР±С‰Р°СЏ РєРѕРЅРІРµСЂСЃРёСЏ"
                            value={`${data.summary.overallConversionRate.toFixed(2)}%`}
                            accentClassName={getConversionColor(data.summary.overallConversionRate)}
                        />
                        <SummaryCard label="Р’СЃРµРіРѕ СЃРѕР±С‹С‚РёР№" value={data.summary.totalEvents} />
                    </section>

                    <section className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6">
                        <SectionHeader
                            title="Р’РѕСЂРѕРЅРєР° РєРѕРЅРІРµСЂСЃРёРё"
                            description="РЎРјРѕС‚СЂРёС‚Рµ, РіРґРµ РёРјРµРЅРЅРѕ С‚РµСЂСЏСЋС‚СЃСЏ СЃРµСЃСЃРёРё РјРµР¶РґСѓ С€Р°РіР°РјРё."
                            className="mb-5"
                        />
                        <div className="space-y-4">
                            {data.funnel.map((step, index) => (
                                <div key={step.step} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                                    <div className="mb-2 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-primary)]">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <p className="type-body text-[var(--text-primary)]">{step.stepName}</p>
                                                <p className="type-caption text-[var(--text-muted)]">{step.totalEvents} РІСЃРµРіРѕ СЃРѕР±С‹С‚РёР№</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="type-label text-[var(--text-secondary)]">{step.uniqueSessions} СЃРµСЃСЃРёР№</p>
                                            {index > 0 ? (
                                                <p className={`type-body ${getConversionColor(step.conversionRate)}`}>{step.conversionRate.toFixed(2)}%</p>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-emphasis)]">
                                        <div
                                            className="h-full bg-[var(--accent-primary)] transition-all duration-500"
                                            style={{
                                                width: `${Math.min((step.uniqueSessions / (data.funnel[0]?.uniqueSessions || 1)) * 100, 100)}%`,
                                            }}
                                        />
                                    </div>
                                    {index > 0 ? (
                                        <p className="type-caption mt-2 text-[var(--text-muted)]">
                                            РљРѕРЅРІРµСЂСЃРёСЏ РѕС‚ РїСЂРµРґС‹РґСѓС‰РµРіРѕ С€Р°РіР°: {step.conversionRate.toFixed(2)}%
                                        </p>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </section>
                </>
            ) : null}
        </div>
    );
}

function SummaryCard({
    label,
    value,
    accentClassName,
}: {
    label: string;
    value: string | number;
    accentClassName?: string;
}) {
    return (
        <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4">
            <p className="type-label text-[var(--text-secondary)]">{label}</p>
            <p className={`type-metric mt-2 ${accentClassName ?? 'text-[var(--text-primary)]'}`}>{value}</p>
        </div>
    );
}
