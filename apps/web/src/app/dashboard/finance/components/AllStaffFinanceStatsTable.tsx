'use client';

import Link from 'next/link';

import type { Period, StaffStat } from './allStaffFinanceStatsTypes';

type TranslationFn = (key: string, fallback: string) => string;

type Props = {
    t: TranslationFn;
    locale: string;
    period: Period;
    staffStats: StaffStat[];
};

export function AllStaffFinanceStatsTable({ t, locale, period, staffStats }: Props) {
    const numberLocale = locale === 'en' ? 'en-US' : 'ru-RU';

    const renderStatus = (stat: StaffStat) => {
        if (period === 'day') {
            if (stat.openShiftsCount > 0) {
                return (
                    <>
                        <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                        <span className="text-xs text-green-600 dark:text-green-400">
                            {t('finance.staffStats.status.open', 'Открыта')}
                        </span>
                    </>
                );
            }

            if (stat.closedShiftsCount > 0) {
                return (
                    <>
                        <span className="inline-flex h-2 w-2 rounded-full bg-gray-400"></span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                            {t('finance.staffStats.status.closed', 'Закрыта')}
                        </span>
                    </>
                );
            }

            return (
                <>
                    <span className="inline-flex h-2 w-2 rounded-full bg-amber-400"></span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                        {t('finance.staffStats.status.noShift', 'Нет смены')}
                    </span>
                </>
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
    };

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
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {stat.staffName}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">{renderStatus(stat)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        {t('finance.staffStats.turnover', 'Оборот')}
                                    </div>
                                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                                        {stat.totalAmount.toLocaleString(numberLocale)} сом
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
                                        {stat.totalMaster.toLocaleString(numberLocale)} сом
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        {t('finance.staffStats.toBusiness', 'Бизнесу')}
                                    </div>
                                    <div className="font-medium text-indigo-600 dark:text-indigo-400">
                                        {stat.totalSalon.toLocaleString(numberLocale)} сом
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
                                        <div className="flex items-center justify-end gap-2">{renderStatus(stat)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {stat.totalAmount.toLocaleString(numberLocale)} сом
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                            {stat.totalMaster.toLocaleString(numberLocale)} сом
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                            {stat.totalSalon.toLocaleString(numberLocale)} сом
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
