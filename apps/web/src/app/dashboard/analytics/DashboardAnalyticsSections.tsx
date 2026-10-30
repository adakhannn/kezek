'use client';

import type {
    BranchOption,
    DashboardTrendChartData,
    LoadResponse,
    OverviewByDayPoint,
    OverviewSummary,
    PeriodPreset,
} from './types';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

function formatNumber(value: number, locale: string) {
    return value.toLocaleString(locale);
}

function formatCurrencyKGS(value: number, locale: string) {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'KGS',
        maximumFractionDigits: 0,
    }).format(value);
}

function getHeatmapRowClass(intensity: number) {
    if (intensity === 0) return 'bg-gray-50 dark:bg-gray-900';
    if (intensity < 0.33) return 'bg-emerald-50 dark:bg-emerald-900/30';
    if (intensity < 0.66) return 'bg-emerald-100 dark:bg-emerald-800/50';
    return 'bg-emerald-200 dark:bg-emerald-700/70';
}

export function DashboardAnalyticsLoading() {
    const { t } = useLanguage();
    return (
        <div className="px-4 py-10">
            <div className="flex items-center justify-center">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{t('analytics.loading')}</span>
                </div>
            </div>
        </div>
    );
}

export function DashboardAnalyticsEmpty() {
    const { t } = useLanguage();
    return <section role="status" className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-2">
        <h2 className="text-lg font-semibold">{t('analytics.emptyTitle')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('analytics.emptyHint')}</p>
    </section>;
}

export function DashboardAnalyticsError({
    error,
    onRetry,
}: {
    error: string;
    onRetry: () => void;
}) {
    const { t } = useLanguage();
    return (
        <div className="px-4 py-10">
            <div className="mx-auto max-w-xl">
                <AlertBanner
                    variant="danger"
                    title={t('analytics.error')}
                    message={error}
                    action={
                        <Button type="button" variant="danger" size="sm" onClick={onRetry}>
                            {t('analytics.retry')}
                        </Button>
                    }
                    className="rounded-2xl p-6 shadow-sm"
                />
            </div>
        </div>
    );
}

export function DashboardAnalyticsHeader() {
    const { t } = useLanguage();
    return (
        <header className="space-y-1">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{t('analytics.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('analytics.description')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('analytics.businessHint')}
            </p>
        </header>
    );
}

export function DashboardAnalyticsFiltersSection({
    periodPreset,
    onPresetChange,
    startDate,
    endDate,
    branchId,
    branches,
    onStartDateChange,
    onEndDateChange,
    onBranchIdChange,
}: {
    periodPreset: PeriodPreset;
    onPresetChange: (preset: PeriodPreset) => void;
    startDate: string;
    endDate: string;
    branchId: string;
    branches: BranchOption[];
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onBranchIdChange: (value: string) => void;
}) {
    const { t } = useLanguage();
    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('analytics.period')}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('analytics.periodHint')}
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                        {t('analytics.quick')}
                    </p>
                    <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1 text-xs font-medium">
                        {(['7', '30', '90', 'custom'] as PeriodPreset[]).map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => onPresetChange(preset)}
                                className={`px-3 py-1.5 rounded-full transition-colors ${
                                    periodPreset === preset
                                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                                }`}
                            >
                                {t(preset === '7' ? 'analytics.days7' : preset === '30' ? 'analytics.days30' : preset === '90' ? 'analytics.days90' : 'analytics.custom')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">{t('analytics.branch')}</p>
                    <select
                        aria-label={t('analytics.branch')}
                        value={branchId}
                        onChange={(event) => onBranchIdChange(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="all">{t('analytics.allBranches')}</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {t('analytics.branchHint')}
                    </p>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">{t('analytics.start')}</p>
                    <input
                        type="date"
                        aria-label={t('analytics.start')}
                        value={startDate}
                        onChange={(event) => onStartDateChange(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">{t('analytics.end')}</p>
                    <input
                        type="date"
                        aria-label={t('analytics.end')}
                        value={endDate}
                        onChange={(event) => onEndDateChange(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>
        </section>
    );
}

export function DashboardAnalyticsKpiSection({
    summary,
}: {
    summary: OverviewSummary;
}) {
    const { t, locale } = useLanguage();
    return (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    {t('analytics.created')}
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formatNumber(summary.bookings.created, locale)}
                </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    {t('analytics.confirmed')}
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formatNumber(summary.bookings.confirmedOrPaid, locale)}
                </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    {t('analytics.conversion')}
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {summary.funnel.conversionHomeToBooking.toFixed(2)}%
                </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    {t('analytics.revenue')}
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrencyKGS(summary.revenue.total, locale)}
                </p>
            </div>
        </section>
    );
}

export function DashboardAnalyticsTrendsSection({
    byDay,
    summary,
    promoShare,
    trendChartData,
}: {
    byDay: OverviewByDayPoint[];
    summary: OverviewSummary;
    promoShare: number;
    trendChartData: DashboardTrendChartData | null;
}) {
    const { t, locale } = useLanguage();
    return (
        <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('analytics.trend')}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('analytics.trendHint')}
                        </p>
                    </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                    {byDay.map((point) => (
                        <div key={point.date} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">{point.date}</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                {formatNumber(point.bookingsConfirmedOrPaid, locale)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('analytics.promo')}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('analytics.promoHint')}
                        </p>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{t('analytics.promoRevenue')}</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrencyKGS(summary.revenue.promoRevenue, locale)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{t('analytics.promoShare')}</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{promoShare.toFixed(2)}%</span>
                    </div>
                </div>

                {trendChartData && (
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-2">
                        {trendChartData.revenue.map((point) => (
                            <div key={point.x} className="flex items-center justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">{point.x}</span>
                                <span className="text-gray-900 dark:text-gray-100">{formatCurrencyKGS(point.y, locale)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

export function DashboardAnalyticsLoadSection({
    loadData,
}: {
    loadData: LoadResponse['data'];
}) {
    const { t, locale } = useLanguage();
    if (!loadData) {
        return null;
    }

    const maxBookings = Math.max(...loadData.points.map((point) => point.bookingsCount || 1), 1);

    return (
        <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('analytics.load')}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('analytics.loadHint')}
                    </p>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-separate border-spacing-y-1">
                    <thead>
                        <tr>
                            <th className="text-left text-gray-500 dark:text-gray-400 px-2 py-1">{t('analytics.hour')}</th>
                            <th className="text-right text-gray-500 dark:text-gray-400 px-2 py-1">{t('analytics.bookings')}</th>
                            <th className="text-right text-gray-500 dark:text-gray-400 px-2 py-1">{t('analytics.promotions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 24 }).map((_, hour) => {
                            const total = loadData.points
                                .filter((point) => point.hour === hour)
                                .reduce((sum, point) => sum + point.bookingsCount, 0);
                            const promo = loadData.points
                                .filter((point) => point.hour === hour)
                                .reduce((sum, point) => sum + point.promoBookingsCount, 0);
                            const intensity = total === 0 ? 0 : Math.min(1, total / maxBookings);

                            return (
                                <tr key={hour} className={`${getHeatmapRowClass(intensity)} rounded-xl`}>
                                    <td className="px-2 py-1 text-gray-700 dark:text-gray-200">{hour}:00</td>
                                    <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">
                                        {total ? formatNumber(total, locale) : '—'}
                                    </td>
                                    <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">
                                        {promo ? formatNumber(promo, locale) : '—'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

