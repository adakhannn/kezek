'use client';

import type {
    BranchOption,
    DashboardTrendChartData,
    LoadResponse,
    OverviewByDayPoint,
    OverviewSummary,
    PeriodPreset,
} from './types';

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

function getHeatmapRowClass(intensity: number) {
    if (intensity === 0) return 'bg-gray-50 dark:bg-gray-900';
    if (intensity < 0.33) return 'bg-emerald-50 dark:bg-emerald-900/30';
    if (intensity < 0.66) return 'bg-emerald-100 dark:bg-emerald-800/50';
    return 'bg-emerald-200 dark:bg-emerald-700/70';
}

export function DashboardAnalyticsLoading() {
    return (
        <div className="px-4 py-10">
            <div className="flex items-center justify-center">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Загружаем аналитику по бизнесу...</span>
                </div>
            </div>
        </div>
    );
}

export function DashboardAnalyticsError({
    error,
    onRetry,
}: {
    error: string;
    onRetry: () => void;
}) {
    return (
        <div className="px-4 py-10">
            <div className="max-w-xl mx-auto bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-red-900 dark:text-red-50 mb-2">Ошибка загрузки аналитики</h1>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
                >
                    <span>Попробовать снова</span>
                </button>
            </div>
        </div>
    );
}

export function DashboardAnalyticsHeader() {
    return (
        <header className="space-y-1">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Аналитика бизнеса</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Краткий обзор воронки бронирований и выручки по вашему бизнесу.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Данные отображаются для текущего выбранного бизнеса в переключателе слева.
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
    return (
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Период</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Выберите период, за который нужно посмотреть конверсию и выручку.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                        Быстрый выбор
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
                                {preset === '7' ? '7 дней' : preset === '30' ? '30 дней' : preset === '90' ? '90 дней' : 'Свой период'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">Филиал</p>
                    <select
                        value={branchId}
                        onChange={(event) => onBranchIdChange(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="all">Все филиалы</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Фильтр по филиалу влияет на блок «Загрузка по часам».
                    </p>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">Начало</p>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(event) => onStartDateChange(event.target.value)}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">Окончание</p>
                    <input
                        type="date"
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
    return (
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Создано бронирований
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formatNumber(summary.bookings.created)}
                </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Подтверждено/оплачено
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formatNumber(summary.bookings.confirmedOrPaid)}
                </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Конверсия из выдачи в бронь
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {summary.funnel.conversionHomeToBooking.toFixed(2)}%
                </p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Выручка за период
                </p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrencyKGS(summary.revenue.total)}
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
    return (
        <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Динамика бронирований</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Как менялось количество подтверждённых бронирований по дням.
                        </p>
                    </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                    {byDay.map((point) => (
                        <div key={point.date} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">{point.date}</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                {formatNumber(point.bookingsConfirmedOrPaid)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Выручка и доля промо</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Сравнение общей выручки и доли выручки по промо-акциям.
                        </p>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Выручка по промо</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                            {formatCurrencyKGS(summary.revenue.promoRevenue)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Доля промо в выручке</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{promoShare.toFixed(2)}%</span>
                    </div>
                </div>

                {trendChartData && (
                    <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-2">
                        {trendChartData.revenue.map((point) => (
                            <div key={point.x} className="flex items-center justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">{point.x}</span>
                                <span className="text-gray-900 dark:text-gray-100">{formatCurrencyKGS(point.y)}</span>
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
    if (!loadData) {
        return null;
    }

    const maxBookings = Math.max(...loadData.points.map((point) => point.bookingsCount || 1), 1);

    return (
        <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Загрузка по часам</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Простая heatmap по часам для оценки часов пик по выбранному периоду и филиалу.
                    </p>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs border-separate border-spacing-y-1">
                    <thead>
                        <tr>
                            <th className="text-left text-gray-500 dark:text-gray-400 px-2 py-1">Час</th>
                            <th className="text-right text-gray-500 dark:text-gray-400 px-2 py-1">Брони</th>
                            <th className="text-right text-gray-500 dark:text-gray-400 px-2 py-1">Промо</th>
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
                                        {total ? formatNumber(total) : '—'}
                                    </td>
                                    <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">
                                        {promo ? formatNumber(promo) : '—'}
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
