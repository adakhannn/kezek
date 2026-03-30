'use client';

import { StaffFinanceShiftCard } from './StaffFinanceShiftCard';

import { formatDate } from '@/lib/dateFormat';
import type { StaffFinanceStatsPayload, StaffFinanceStatsPeriod } from '@/lib/finance/types';


function formatMoney(value: number, locale: string) {
    return `${value.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом`;
}

export function StaffFinanceStatsFilters({
    period,
    date,
    loading,
    onPeriodChange,
    onDateChange,
    onRefresh,
    t,
}: {
    period: StaffFinanceStatsPeriod;
    date: string;
    loading: boolean;
    onPeriodChange: (period: StaffFinanceStatsPeriod) => void;
    onDateChange: (date: string) => void;
    onRefresh: () => void;
    t: (key: string, fallback: string) => string;
}) {
    return (
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 flex-wrap">
                {(['day', 'month', 'year'] as StaffFinanceStatsPeriod[]).map((value) => (
                    <button
                        key={value}
                        onClick={() => onPeriodChange(value)}
                        disabled={loading}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            period === value
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                        } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {value === 'day' && t('finance.period.day', 'День')}
                        {value === 'month' && t('finance.period.month', 'Месяц')}
                        {value === 'year' && t('finance.period.year', 'Год')}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <input
                    type={period === 'year' ? 'number' : period === 'month' ? 'month' : 'date'}
                    value={period === 'year' ? date.split('-')[0] : period === 'month' ? (date.substring(0, 7) || date) : date}
                    disabled={loading}
                    onChange={(event) => {
                        if (period === 'year') {
                            onDateChange(`${event.target.value}-01-01`);
                        } else if (period === 'month') {
                            onDateChange(event.target.value.length === 7 ? `${event.target.value}-01` : event.target.value);
                        } else {
                            onDateChange(event.target.value);
                        }
                    }}
                    className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? t('finance.loading', 'Загрузка...') : t('finance.update', 'Обновить')}
                </button>
            </div>
        </div>
    );
}

export function StaffFinanceStatsRefreshing({ t }: { t: (key: string, fallback: string) => string }) {
    return (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 -mt-2">
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>{t('finance.loading', 'Загрузка...')}</span>
        </div>
    );
}

export function StaffFinanceStatsSummary({
    stats,
    period,
    periodLabel,
    locale,
    t,
}: {
    stats: StaffFinanceStatsPayload;
    period: StaffFinanceStatsPeriod;
    periodLabel: string;
    locale: string;
    t: (key: string, fallback: string) => string;
}) {
    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        {t('finance.staffStats.turnover', 'Оборот')}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{formatMoney(stats.totalAmount, locale)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{periodLabel}</div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-800/50 p-5">
                    <div className="text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
                        {t('finance.staffStats.toEmployee', 'Доля сотрудника')}
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{formatMoney(stats.totalMaster, locale)}</div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
                        {stats.totalAmount > 0 ? `${((stats.totalMaster / stats.totalAmount) * 100).toFixed(1)}%` : '0%'}
                    </div>
                    {stats.hasGuaranteedPayment && stats.totalBaseMasterShare !== undefined && stats.totalGuaranteedAmount !== undefined && (
                        <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/50 space-y-1">
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-tight">
                                {t('finance.staffStats.baseShare', 'Базовая доля')}:{' '}
                                <span className="font-medium">{formatMoney(stats.totalBaseMasterShare, locale)}</span>
                            </div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                                {t('finance.staffStats.guaranteedAmount', 'За выход')}:{' '}
                                <span className="font-medium">+{formatMoney(stats.totalGuaranteedAmount, locale)}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg border border-indigo-200 dark:border-indigo-800/50 p-5">
                    <div className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">
                        {t('finance.staffStats.toBusiness', 'Доля бизнеса')}
                    </div>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">{formatMoney(stats.totalSalon, locale)}</div>
                    <div className="text-xs text-indigo-600 dark:text-indigo-400">
                        {stats.totalAmount > 0 ? `${((stats.totalSalon / stats.totalAmount) * 100).toFixed(1)}%` : '0%'}
                    </div>
                </div>
            </div>

            {period === 'day' && (
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-3">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {t('finance.shifts', 'Статус смены')}
                        </div>
                        {stats.openShiftsCount > 0 ? (
                            <>
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                    {t('finance.staffStats.status.open', 'Смена открыта')}
                                </span>
                            </>
                        ) : stats.closedShiftsCount > 0 ? (
                            <>
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gray-400"></span>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {t('finance.staffStats.status.closed', 'Смена закрыта')}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400"></span>
                                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                                    {t('finance.staffStats.status.noShift', 'Смена не открыта')}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('finance.staffStats.shifts', 'Смен')}</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.shiftsCount}</div>
                    {(stats.openShiftsCount > 0 || stats.closedShiftsCount > 0) && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                            {stats.openShiftsCount > 0 && (
                                <span className="text-green-600 dark:text-green-400">
                                    {stats.openShiftsCount} {t('finance.shifts.open', 'откр.')}
                                </span>
                            )}
                            {stats.openShiftsCount > 0 && stats.closedShiftsCount > 0 && ' • '}
                            {stats.closedShiftsCount > 0 && (
                                <span className="text-gray-600 dark:text-gray-400">
                                    {stats.closedShiftsCount} {t('finance.shifts.closed', 'закр.')}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.consumables', 'Расходники')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatMoney(stats.totalConsumables, locale)}</div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.late', 'Опоздания')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalLateMinutes} <span className="text-xs text-gray-500">мин</span>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.clients', 'Клиентов')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{stats.totalClients}</div>
                </div>
            </div>
        </>
    );
}

export function StaffFinanceStatsShifts({
    stats,
    locale,
    t,
    onHoursUpdated,
}: {
    stats: StaffFinanceStatsPayload;
    locale: string;
    t: (key: string, fallback: string) => string;
    onHoursUpdated: () => void | Promise<void>;
}) {
    if (stats.shifts.length === 0) {
        return null;
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wide">
                {t('finance.staffStats.shiftsPeriod', 'Смены за период')}
            </h3>
            <div className="space-y-2">
                {stats.shifts.map((shift) => (
                    <StaffFinanceShiftCard
                        key={shift.id}
                        shift={shift}
                        formatDate={formatDate}
                        locale={locale}
                        t={t}
                        onHoursUpdated={onHoursUpdated}
                    />
                ))}
            </div>
        </div>
    );
}
