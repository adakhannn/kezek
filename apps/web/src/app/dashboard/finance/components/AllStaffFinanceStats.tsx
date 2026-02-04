'use client';

import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { TZ } from '@/lib/time';

type Period = 'day' | 'month' | 'year';

type StaffStat = {
    staffId: string;
    staffName: string;
    isActive: boolean;
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
};

type TotalStats = {
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
    totalShifts: number;
    totalOpenShifts: number;
    totalClosedShifts: number;
};

type BranchOption = {
    id: string;
    name: string;
};

export default function AllStaffFinanceStats() {
    const { t, locale } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('day');
    const [date, setDate] = useState(formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
    const [totalStats, setTotalStats] = useState<TotalStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [branchId, setBranchId] = useState<string | 'all'>('all');

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                period,
                date,
            });
            if (branchId !== 'all') {
                params.set('branchId', branchId);
            }

            const res = await fetch(`/api/dashboard/finance/all?${params.toString()}`, {
                cache: 'no-store',
            });
            const json = await res.json();
            if (!json.ok) {
                // Показываем детали ошибки, если они есть
                const errorMsg = json.message || json.error || t('finance.loading', 'Не удалось загрузить статистику');
                const errorDetails = json.details ? ` (${JSON.stringify(json.details)})` : '';
                throw new Error(errorMsg + errorDetails);
            }

            const apiBranches: BranchOption[] = Array.isArray(json.branches)
                ? json.branches.map((b: { id: string; name: string }) => ({
                      id: String(b.id),
                      name: String(b.name),
                  }))
                : [];
            setBranches(apiBranches);
            setStaffStats(json.staffStats || []);
            setTotalStats(json.totalStats || null);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            console.error('Error loading stats:', e);
        } finally {
            setLoading(false);
        }
    }, [period, date, branchId, t]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    // Автоматическое обновление статистики для периода "день" каждую минуту
    // чтобы видеть актуальные данные открытых смен в реальном времени
    useEffect(() => {
        if (period !== 'day') return;
        
        const interval = setInterval(() => {
            void loadStats();
        }, 60000); // Обновляем каждую минуту

        return () => clearInterval(interval);
    }, [period, loadStats]);

    const formatPeriodLabel = () => {
        if (period === 'day') {
            return new Date(date + 'T12:00:00').toLocaleDateString(locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
            });
        } else if (period === 'month') {
            const [year, month] = date.split('-');
            return new Date(`${year}-${month}-01`).toLocaleDateString(locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU', {
                month: 'long',
                year: 'numeric',
            });
        } else {
            return date.split('-')[0];
        }
    };

    if (loading && !totalStats) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500 dark:text-gray-400">
                    {t('finance.loading', 'Загрузка...')}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Фильтры */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setPeriod('day')}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                            period === 'day'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t('finance.period.day', 'День')}
                    </button>
                    <button
                        onClick={() => setPeriod('month')}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                            period === 'month'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t('finance.period.month', 'Месяц')}
                    </button>
                    <button
                        onClick={() => setPeriod('year')}
                        className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                            period === 'year'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t('finance.period.year', 'Год')}
                    </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {branches.length > 0 && (
                        <select
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value as string | 'all')}
                            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100"
                        >
                            <option value="all">
                                {t('finance.branch.all', 'Все филиалы')}
                            </option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    )}
                    <input
                        type={period === 'year' ? 'number' : period === 'month' ? 'month' : 'date'}
                        value={period === 'year' ? date.split('-')[0] : date}
                        onChange={(e) => {
                            if (period === 'year') {
                                setDate(`${e.target.value}-01-01`);
                            } else {
                                setDate(e.target.value);
                            }
                        }}
                        className="flex-1 sm:flex-none px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    />
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {loading ? t('finance.loading', 'Загрузка...') : t('finance.update', 'Обновить')}
                    </button>
                </div>
            </div>

            {/* Общая статистика */}
            {totalStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                        <div className="text-xs uppercase tracking-wide text-indigo-100 mb-2">
                            {t('finance.totalTurnover', 'Общий оборот')}
                        </div>
                        <div className="text-xl sm:text-2xl font-bold">
                            {totalStats.totalAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                        </div>
                        <div className="text-xs text-indigo-100 mt-1">{formatPeriodLabel()}</div>
                    </div>

                    <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                        <div className="text-xs uppercase tracking-wide text-emerald-100 mb-2">
                            {t('finance.toEmployees', 'Сотрудникам')}
                        </div>
                        <div className="text-xl sm:text-2xl font-bold">
                            {totalStats.totalMaster.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
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
                            {totalStats.totalSalon.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
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
                                    {totalStats.totalOpenShifts}{' '}
                                    {t('finance.shifts.open', 'открыта')}
                                </span>
                            )}
                            {totalStats.totalOpenShifts > 0 && totalStats.totalClosedShifts > 0 && ' • '}
                            {totalStats.totalClosedShifts > 0 && (
                                <span>
                                    {totalStats.totalClosedShifts}{' '}
                                    {t('finance.shifts.closed', 'закрыта')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Таблица сотрудников */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {t('finance.staffStats.title', 'Статистика по сотрудникам')}
                    </h2>
                </div>
                
                {/* Мобильный вид (карточки) */}
                <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-800">
                    {staffStats.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            {t('finance.staffStats.noData', 'Нет данных за выбранный период')}
                        </div>
                    ) : (
                        staffStats.map((stat) => (
                            <div
                                key={stat.staffId}
                                className="p-4 space-y-3"
                            >
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
                                            {period === 'day' && (
                                                <div className="flex items-center gap-2 mt-1">
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
                                            )}
                                            {period !== 'day' && (
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                                                        stat.isActive
                                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                                    }`}
                                                >
                                                    {stat.isActive
                                                        ? t('finance.staffStats.status.active', 'Активен')
                                                        : t('finance.staffStats.status.inactive', 'Неактивен')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            {t('finance.staffStats.turnover', 'Оборот')}
                                        </div>
                                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                                            {stat.totalAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
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
                                            {stat.totalMaster.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            {t('finance.staffStats.toBusiness', 'Бизнесу')}
                                        </div>
                                        <div className="font-medium text-indigo-600 dark:text-indigo-400">
                                            {stat.totalSalon.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
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
                
                {/* Десктопный вид (таблица) */}
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
                                    <tr
                                        key={stat.staffId}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                    >
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
                                            {period === 'day' && (
                                                <div className="flex items-center justify-end gap-2">
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
                                            )}
                                            {period !== 'day' && (
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
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                {stat.totalAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                {stat.totalMaster.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                                {stat.totalSalon.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="text-sm text-gray-900 dark:text-gray-100">
                                                {stat.shiftsCount}
                                            </div>
                                            {stat.openShiftsCount > 0 && (
                                                <div className="text-xs text-green-600 dark:text-green-400">
                                                    {stat.openShiftsCount}{' '}
                                                    {t('finance.shifts.open', 'открыта')}
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
        </div>
    );
}

