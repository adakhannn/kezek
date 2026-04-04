'use client';

import type { BranchOption, OverviewByDayPoint, OverviewSummary, PeriodPreset, TrendChartData } from './types';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

function formatNumber(value: number) {
    return value.toLocaleString('ru-RU');
}

function formatCurrencyKGS(value: number) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'KGS',
        maximumFractionDigits: 0,
    }).format(value);
}

export function AdminAnalyticsOverviewLoading() {
    return (
        <div className="px-4 py-10">
            <div className="flex items-center justify-center">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Р—Р°РіСЂСѓР¶Р°РµРј РѕР±Р·РѕСЂ Р°РЅР°Р»РёС‚РёРєРё...</span>
                </div>
            </div>
        </div>
    );
}

export function AdminAnalyticsOverviewError({
    error,
    onRetry,
}: {
    error: string;
    onRetry: () => void;
}) {
    return (
        <div className="px-4 py-10">
            <div className="mx-auto max-w-xl">
                <AlertBanner
                    variant="danger"
                    title="РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РѕР±Р·РѕСЂР°"
                    message={error}
                    action={
                        <Button type="button" variant="danger" size="sm" onClick={onRetry}>
                            РџРѕРїСЂРѕР±РѕРІР°С‚СЊ СЃРЅРѕРІР°
                        </Button>
                    }
                />
            </div>
        </div>
    );
}

export function AdminAnalyticsFiltersSection({
    periodPreset,
    onPresetChange,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    branchId,
    onBranchIdChange,
    branches,
}: {
    periodPreset: PeriodPreset;
    onPresetChange: (preset: PeriodPreset) => void;
    startDate: string;
    endDate: string;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    branchId: string;
    onBranchIdChange: (value: string) => void;
    branches: BranchOption[];
}) {
    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Р¤РёР»СЊС‚СЂС‹</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        РџРµСЂРёРѕРґ Рё С„РёР»РёР°Р» Р·Р°РґР°СЋС‚ СЃСЂРµР· РґР»СЏ РІСЃРµС… РјРµС‚СЂРёРє Рё С‚СЂРµРЅРґРѕРІ.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">РџРµСЂРёРѕРґ</p>
                    <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1 text-xs font-medium">
                        {(['7', '30', '90', 'custom'] as PeriodPreset[]).map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => onPresetChange(preset)}
                                className={`px-3 py-1 rounded-full transition-colors ${
                                    periodPreset === preset
                                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                            >
                                {preset === '7' && '7 РґРЅРµР№'}
                                {preset === '30' && '30 РґРЅРµР№'}
                                {preset === '90' && '90 РґРЅРµР№'}
                                {preset === 'custom' && 'РљР°СЃС‚РѕРјРЅС‹Р№'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                        Р”Р°С‚Р° РЅР°С‡Р°Р»Р°
                    </label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(event) => onStartDateChange(event.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                        Р”Р°С‚Р° РѕРєРѕРЅС‡Р°РЅРёСЏ
                    </label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(event) => onEndDateChange(event.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                        Р¤РёР»РёР°Р»
                    </label>
                    <select
                        value={branchId}
                        onChange={(event) => onBranchIdChange(event.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="all">Р’СЃРµ С„РёР»РёР°Р»С‹</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </section>
    );
}

export function AdminAnalyticsKpiSection({
    summary,
    promoShare,
}: {
    summary: OverviewSummary;
    promoShare: number;
}) {
    return (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Р‘СЂРѕРЅРё (СѓСЃРїРµС€РЅС‹Рµ)
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {formatNumber(summary.bookings.confirmedOrPaid)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    РР· {formatNumber(summary.bookings.created)} СЃРѕР·РґР°РЅРЅС‹С… Р·Р° РїРµСЂРёРѕРґ
                </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    РљРѕРЅРІРµСЂСЃРёСЏ home в†’ Р±СЂРѕРЅСЊ
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {summary.funnel.conversionHomeToBooking.toFixed(2)}%
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatNumber(summary.funnel.homeViews)} РїСЂРѕСЃРјРѕС‚СЂРѕРІ РіР»Р°РІРЅРѕР№,{' '}
                    {formatNumber(summary.bookings.confirmedOrPaid)} СѓСЃРїРµС€РЅС‹С… Р±СЂРѕРЅРµР№
                </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Р’С‹СЂСѓС‡РєР° (РѕС†РµРЅРєР°)
                </p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrencyKGS(summary.revenue.total)}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Р’РєР»СЋС‡Р°СЏ РїСЂРѕРјРѕ-РІС‹СЂСѓС‡РєСѓ {formatCurrencyKGS(summary.revenue.promoRevenue)}
                </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Р”РѕР»СЏ РїСЂРѕРјРѕ-Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№
                </p>
                <p className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">{promoShare.toFixed(2)}%</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {formatNumber(summary.revenue.promoBookings)} Р±СЂРѕРЅРµР№ СЃ РїСЂРѕРјРѕ Р·Р° РїРµСЂРёРѕРґ
                </p>
            </div>
        </section>
    );
}

export function AdminAnalyticsTrendsSection({
    trendChartData,
    byDay,
}: {
    trendChartData: TrendChartData | null;
    byDay: OverviewByDayPoint[];
}) {
    return (
        <>
            <section className="grid gap-6 lg:grid-cols-2">
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                РўСЂРµРЅРґ РїРѕ СѓСЃРїРµС€РЅС‹Рј Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏРј
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Р Р°СЃРїСЂРµРґРµР»РµРЅРёРµ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅС‹С…/РѕРїР»Р°С‡РµРЅРЅС‹С… Р±СЂРѕРЅРµР№ РїРѕ РґРЅСЏРј.
                            </p>
                        </div>
                    </div>

                    <div className="h-56">
                        {trendChartData && trendChartData.bookings.length > 0 ? (
                            <ul className="h-full overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                {trendChartData.bookings.map((point) => (
                                    <li key={point.x} className="flex items-center justify-between">
                                        <span className="tabular-nums">{point.x}</span>
                                        <span className="font-semibold">{formatNumber(point.y)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState
                                compact
                                title="РќРµС‚ РґР°РЅРЅС‹С… РїРѕ Р±СЂРѕРЅСЏРј"
                                description="Р—Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ РЅРµС‚ С‚РѕС‡РµРє РґР»СЏ С‚СЂРµРЅРґР° СѓСЃРїРµС€РЅС‹С… Р±СЂРѕРЅРµР№."
                                className="h-full"
                            />
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">РўСЂРµРЅРґ РїРѕ РІС‹СЂСѓС‡РєРµ</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                РћС†РµРЅРѕС‡РЅР°СЏ РІС‹СЂСѓС‡РєР° РїРѕ РґРЅСЏРј СЃ СѓС‡РµС‚РѕРј РїСЂРѕРјРѕ.
                            </p>
                        </div>
                    </div>

                    <div className="h-56">
                        {trendChartData && trendChartData.revenue.length > 0 ? (
                            <ul className="h-full overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-300">
                                {trendChartData.revenue.map((point) => (
                                    <li key={point.x} className="flex items-center justify-between">
                                        <span className="tabular-nums">{point.x}</span>
                                        <span className="font-semibold">{formatCurrencyKGS(point.y)}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyState
                                compact
                                title="РќРµС‚ РґР°РЅРЅС‹С… РїРѕ РІС‹СЂСѓС‡РєРµ"
                                description="Р—Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ РЅРµС‚ С‚РѕС‡РµРє РґР»СЏ С‚СЂРµРЅРґР° РїРѕ РІС‹СЂСѓС‡РєРµ."
                                className="h-full"
                            />
                        )}
                    </div>
                </div>
            </section>

            <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Р”РѕР»СЏ РїСЂРѕРјРѕ-Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№ РїРѕ РґРЅСЏРј
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            РљР°РєСѓСЋ С‡Р°СЃС‚СЊ СѓСЃРїРµС€РЅС‹С… Р±СЂРѕРЅРµР№ СЃРѕСЃС‚Р°РІР»СЏСЋС‚ РїСЂРѕРјРѕ-Р°РєС†РёРё.
                        </p>
                    </div>
                </div>

                <div className="h-64">
                    {trendChartData && trendChartData.promoShare.length > 0 ? (
                        <ul className="h-full overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-300">
                            {trendChartData.promoShare.map((point) => (
                                <li key={point.x} className="flex items-center justify-between">
                                    <span className="tabular-nums">{point.x}</span>
                                    <span className="font-semibold">{point.y.toFixed(2)}%</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState
                            compact
                            title="РќРµС‚ РґР°РЅРЅС‹С… РїРѕ РїСЂРѕРјРѕ-РґРѕР»Рµ"
                            description="Р—Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ РЅРµС‚ РґР°РЅРЅС‹С… РґР»СЏ С‚СЂРµРЅРґР° РґРѕР»Рё РїСЂРѕРјРѕ-Р±СЂРѕРЅРµР№."
                            className="h-full"
                        />
                    )}
                </div>

                <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <summary className="cursor-pointer select-none">РЎС‹СЂС‹Рµ РґР°РЅРЅС‹Рµ РїРѕ РґРЅСЏРј (РґР»СЏ С‚РµС…. СЃРІРµСЂРєРё)</summary>
                    <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-gray-100 dark:border-gray-800">
                        <table className="min-w-full text-[11px]">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-2 py-1 text-left font-medium text-gray-500 dark:text-gray-400">Р”Р°С‚Р°</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Home</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Biz</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Starts</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Created</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Confirmed</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">PromoB</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">PromoRev</th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">TotalRev</th>
                                </tr>
                            </thead>
                            <tbody>
                                {byDay.map((point) => (
                                    <tr key={point.date} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-2 py-1 text-left text-gray-900 dark:text-gray-100">{point.date}</td>
                                        <td className="px-2 py-1 text-right tabular-nums">{point.homeViews}</td>
                                        <td className="px-2 py-1 text-right tabular-nums">{point.businessPageViews}</td>
                                        <td className="px-2 py-1 text-right tabular-nums">{point.bookingFlowStarts}</td>
                                        <td className="px-2 py-1 text-right tabular-nums">{point.bookingsCreated}</td>
                                        <td className="px-2 py-1 text-right tabular-nums">{point.bookingsConfirmedOrPaid}</td>
                                        <td className="px-2 py-1 text-right tabular-nums">{point.promoBookings}</td>
                                        <td className="px-2 py-1 text-right tabular-nums">{point.promoRevenue}</td>
                                        <td className="px-2 py-1 text-right tabular-nums">{point.totalRevenue}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </details>
            </section>
        </>
    );
}
