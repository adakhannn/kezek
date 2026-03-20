'use client';

import type { TotalStats } from './allStaffFinanceStatsTypes';

type TranslationFn = (key: string, fallback: string) => string;

type Props = {
    t: TranslationFn;
    locale: string;
    totalStats: TotalStats | null;
    formatPeriodLabel: () => string;
};

export function AllStaffFinanceStatsOverview({ t, locale, totalStats, formatPeriodLabel }: Props) {
    if (!totalStats) {
        return null;
    }

    const numberLocale = locale === 'en' ? 'en-US' : 'ru-RU';

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                <div className="text-xs uppercase tracking-wide text-indigo-100 mb-2">
                    {t('finance.totalTurnover', 'Общий оборот')}
                </div>
                <div className="text-xl sm:text-2xl font-bold">
                    {totalStats.totalAmount.toLocaleString(numberLocale)} сом
                </div>
                <div className="text-xs text-indigo-100 mt-1">{formatPeriodLabel()}</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                <div className="text-xs uppercase tracking-wide text-emerald-100 mb-2">
                    {t('finance.toEmployees', 'Сотрудникам')}
                </div>
                <div className="text-xl sm:text-2xl font-bold">
                    {totalStats.totalMaster.toLocaleString(numberLocale)} сом
                </div>
                <div className="text-xs text-emerald-100 mt-1">
                    {totalStats.totalAmount > 0
                        ? `${((totalStats.totalMaster / totalStats.totalAmount) * 100).toFixed(1)}%`
                        : '0%'}
                </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                <div className="text-xs uppercase tracking-wide text-blue-100 mb-2">
                    {t('finance.toBusiness', 'Бизнесу')}
                </div>
                <div className="text-xl sm:text-2xl font-bold">
                    {totalStats.totalSalon.toLocaleString(numberLocale)} сом
                </div>
                <div className="text-xs text-blue-100 mt-1">
                    {totalStats.totalAmount > 0
                        ? `${((totalStats.totalSalon / totalStats.totalAmount) * 100).toFixed(1)}%`
                        : '0%'}
                </div>
            </div>

            <div className="bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                <div className="text-xs uppercase tracking-wide text-gray-100 mb-2">
                    {t('finance.shifts', 'Смен')}
                </div>
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
