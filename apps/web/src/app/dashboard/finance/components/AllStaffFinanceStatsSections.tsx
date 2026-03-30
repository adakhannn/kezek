'use client';

import Link from 'next/link';

import type { BranchOption, Period, StaffStat, TotalStats } from './allStaffFinanceStatsTypes';

function formatMoney(value: number, locale: string) {
    return `${value.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом`;
}

function StaffStatus({
    period,
    stat,
    t,
}: {
    period: Period;
    stat: StaffStat;
    t: (key: string, fallback?: string) => string;
}) {
    if (period === 'day') {
        return (
            <div className="flex items-center gap-2">
                {stat.openShiftsCount > 0 ? (
                    <>
                        <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                        <span className="text-xs text-green-600 dark:text-green-400">
                            {t('finance.staffStats.status.open', 'Открыта')}
                        </span>
                    </>
                ) : stat.closedShiftsCount > 0 ? (
                    <>
                        <span className="inline-flex h-2 w-2 rounded-full bg-gray-400"></span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                            {t('finance.staffStats.status.closed', 'Закрыта')}
                        </span>
                    </>
                ) : (
                    <>
                        <span className="inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                            {t('finance.staffStats.status.noShift', 'Нет смены')}
                        </span>
                    </>
                )}
            </div>
        );
    }

    return (
        <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                stat.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
        >
            {stat.isActive
                ? t('finance.staffStats.status.active', 'Активен')
                : t('finance.staffStats.status.inactive', 'Неактивен')}
        </span>
    );
}

export function AllStaffFinanceStatsFilters({
    period,
    date,
    branchId,
    branches,
    loading,
    onPeriodChange,
    onDateChange,
    onBranchChange,
    onRefresh,
    t,
}: {
    period: Period;
    date: string;
    branchId: string | 'all';
    branches: BranchOption[];
    loading: boolean;
    onPeriodChange: (value: Period) => void;
    onDateChange: (value: string) => void;
    onBranchChange: (value: string | 'all') => void;
    onRefresh: () => void;
    t: (key: string, fallback?: string) => string;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
                {(['day', 'month', 'year'] as Period[]).map((value) => (
                    <button
                        key={value}
                        onClick={() => onPeriodChange(value)}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                            period === value
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {value === 'day' && t('finance.period.day', 'День')}
                        {value === 'month' && t('finance.period.month', 'Месяц')}
                        {value === 'year' && t('finance.period.year', 'Год')}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
                {branches.length > 0 && (
                    <select
                        value={branchId}
                        onChange={(event) => onBranchChange(event.target.value as string | 'all')}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                    >
                        <option value="all">{t('finance.branch.all', 'Все филиалы')}</option>
                        {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                                {branch.name}
                            </option>
                        ))}
                    </select>
                )}

                <input
                    type={period === 'year' ? 'number' : period === 'month' ? 'month' : 'date'}
                    value={period === 'year' ? date.split('-')[0] : date}
                    onChange={(event) => onDateChange(period === 'year' ? `${event.target.value}-01-01` : event.target.value)}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                />

                <button
                    onClick={onRefresh}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                    {loading ? t('finance.loading', 'Загрузка...') : t('finance.update', 'Обновить')}
                </button>
            </div>
        </div>
    );
}

export function AllStaffFinanceStatsTotals({
    totalStats,
    periodLabel,
    locale,
    t,
}: {
    totalStats: TotalStats;
    periodLabel: string;
    locale: string;
    t: (key: string, fallback?: string) => string;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                <div className="text-xs uppercase tracking-wide text-indigo-100 mb-2">
                    {t('finance.totalTurnover', 'Общий оборот')}
                </div>
                <div className="text-xl sm:text-2xl font-bold">{formatMoney(totalStats.totalAmount, locale)}</div>
                <div className="text-xs text-indigo-100 mt-1">{periodLabel}</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                <div className="text-xs uppercase tracking-wide text-emerald-100 mb-2">
                    {t('finance.toEmployees', 'Сотрудникам')}
                </div>
                <div className="text-xl sm:text-2xl font-bold">{formatMoney(totalStats.totalMaster, locale)}</div>
                <div className="text-xs text-emerald-100 mt-1">
                    {totalStats.totalAmount > 0 ? `${((totalStats.totalMaster / totalStats.totalAmount) * 100).toFixed(1)}%` : '0%'}
                </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                <div className="text-xs uppercase tracking-wide text-blue-100 mb-2">
                    {t('finance.toBusiness', 'Бизнесу')}
                </div>
                <div className="text-xl sm:text-2xl font-bold">{formatMoney(totalStats.totalSalon, locale)}</div>
                <div className="text-xs text-blue-100 mt-1">
                    {totalStats.totalAmount > 0 ? `${((totalStats.totalSalon / totalStats.totalAmount) * 100).toFixed(1)}%` : '0%'}
                </div>
            </div>

            <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                <div className="text-xs uppercase tracking-wide text-gray-100 mb-2">{t('finance.shifts', 'Смен')}</div>
                <div className="text-xl sm:text-2xl font-bold">{totalStats.totalShifts}</div>
                <div className="text-xs text-gray-100 mt-1">
                    {totalStats.totalOpenShifts > 0 && (
                        <span>
                            {totalStats.totalOpenShifts} {t('finance.shifts.open', 'открыта')}
                        </span>
                    )}
                    {totalStats.totalOpenShifts > 0 && totalStats.totalClosedShifts > 0 && ' • '}
                    {totalStats.totalClosedShifts > 0 && (
                        <span>
                            {totalStats.totalClosedShifts} {t('finance.shifts.closed', 'закрыта')}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export function AllStaffFinanceStatsTable({
    staffStats,
    period,
    locale,
    t,
}: {
    staffStats: StaffStat[];
    period: Period;
    locale: string;
    t: (key: string, fallback?: string) => string;
}) {
    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {t('finance.staffStats.title', 'Статистика по сотрудникам')}
                </h2>
            </div>

            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-800">
                {staffStats.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        {t('finance.staffStats.noData', 'Нет данных за выбранный период')}
                    </div>
                ) : (
                    staffStats.map((stat) => (
                        <div key={stat.staffId} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                        <span className="text-indigo-600 dark:text-indigo-400 font-medium text-sm">
                                            {stat.staffName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{stat.staffName}</div>
                                        <div className="mt-1">
                                            <StaffStatus period={period} stat={stat} t={t} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        {t('finance.staffStats.turnover', 'Оборот')}
                                    </div>
                                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                                        {formatMoney(stat.totalAmount, locale)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        {t('finance.staffStats.shifts', 'Смен')}
                                    </div>
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                        {stat.shiftsCount}
                                        {stat.openShiftsCount > 0 && (
                                            <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                                                ({stat.openShiftsCount} {t('finance.shifts.open', 'открыта')})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        {t('finance.staffStats.toEmployee', 'Сотруднику')}
                                    </div>
                                    <div className="font-medium text-emerald-600 dark:text-emerald-400">
                                        {formatMoney(stat.totalMaster, locale)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        {t('finance.staffStats.toBusiness', 'Бизнесу')}
                                    </div>
                                    <div className="font-medium text-indigo-600 dark:text-indigo-400">
                                        {formatMoney(stat.totalSalon, locale)}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Link
                                    href={`/dashboard/staff/${stat.staffId}/finance`}
                                    className="block w-full text-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                                >
                                    {t('finance.staffStats.details', 'Детали →')}
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-[96]">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('finance.staffStats.employee', 'Сотрудник')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('finance.staffStats.status', 'Статус')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('finance.staffStats.turnover', 'Оборот')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('finance.staffStats.toEmployee', 'Сотруднику')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('finance.staffStats.toBusiness', 'Бизнесу')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('finance.staffStats.shifts', 'Смен')}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {t('finance.staffStats.actions', 'Действия')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {staffStats.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                    {t('finance.staffStats.noData', 'Нет данных за выбранный период')}
                                </td>
                            </tr>
                        ) : (
                            staffStats.map((stat) => (
                                <tr key={stat.staffId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                                <span className="text-indigo-600 dark:text-indigo-400 font-medium text-sm">
                                                    {stat.staffName.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {stat.staffName}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex justify-end">
                                            <StaffStatus period={period} stat={stat} t={t} />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {formatMoney(stat.totalAmount, locale)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                            {formatMoney(stat.totalMaster, locale)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                            {formatMoney(stat.totalSalon, locale)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm text-gray-900 dark:text-gray-100">{stat.shiftsCount}</div>
                                        {stat.openShiftsCount > 0 && (
                                            <div className="text-xs text-green-600 dark:text-green-400">
                                                {stat.openShiftsCount} {t('finance.shifts.open', 'открыта')}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <Link
                                            href={`/dashboard/staff/${stat.staffId}/finance`}
                                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-sm font-medium"
                                        >
                                            {t('finance.staffStats.details', 'Детали →')}
                                        </Link>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
