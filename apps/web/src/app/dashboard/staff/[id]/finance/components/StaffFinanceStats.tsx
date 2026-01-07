'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useState } from 'react';

import { TZ } from '@/lib/time';

type Period = 'day' | 'month' | 'year';

type Stats = {
    period: Period;
    dateFrom: string;
    dateTo: string;
    staffName: string;
    shiftsCount: number;
    openShiftsCount: number;
    closedShiftsCount: number;
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalConsumables: number;
    totalLateMinutes: number;
    shifts: Array<{
        id: string;
        shift_date: string;
        status: 'open' | 'closed';
        opened_at: string | null;
        closed_at: string | null;
        total_amount: number;
        consumables_amount: number;
        master_share: number;
        salon_share: number;
        late_minutes: number;
    }>;
};

export default function StaffFinanceStats({ staffId }: { staffId: string }) {
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('day');
    const [date, setDate] = useState(formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [stats, setStats] = useState<Stats | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/dashboard/staff/${staffId}/finance/stats?period=${period}&date=${date}`,
                { cache: 'no-store' }
            );
            const json = await res.json();
            if (!json.ok) {
                throw new Error(json.error || 'Не удалось загрузить статистику');
            }
            setStats(json.stats);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            console.error('Error loading stats:', e);
        } finally {
            setLoading(false);
        }
    }, [staffId, period, date]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr + 'T12:00:00').toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const formatPeriodLabel = () => {
        if (period === 'day') {
            return formatDate(date);
        } else if (period === 'month') {
            const [year, month] = date.split('-');
            return new Date(`${year}-${month}-01`).toLocaleDateString('ru-RU', {
                month: 'long',
                year: 'numeric',
            });
        } else {
            return date.split('-')[0];
        }
    };

    if (loading && !stats) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-500 dark:text-gray-400">Загрузка...</div>
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

    if (!stats) {
        return null;
    }

    return (
        <div className="space-y-6">
            {/* Фильтры */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPeriod('day')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            period === 'day'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        День
                    </button>
                    <button
                        onClick={() => setPeriod('month')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            period === 'month'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        Месяц
                    </button>
                    <button
                        onClick={() => setPeriod('year')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            period === 'year'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        Год
                    </button>
                </div>
                <div className="flex items-center gap-2">
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
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    />
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Загрузка...' : 'Обновить'}
                    </button>
                </div>
            </div>

            {/* Основная статистика */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Статус смены (для дня) */}
                {period === 'day' && (
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                            Статус смены
                        </div>
                        <div className="flex items-center gap-2">
                            {stats.openShiftsCount > 0 ? (
                                <>
                                    <span className="inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                                    <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                                        Смена открыта
                                    </span>
                                </>
                            ) : stats.closedShiftsCount > 0 ? (
                                <>
                                    <span className="inline-flex h-3 w-3 rounded-full bg-gray-400"></span>
                                    <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                                        Смена закрыта
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="inline-flex h-3 w-3 rounded-full bg-amber-400"></span>
                                    <span className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                                        Смена не открыта
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Оборот */}
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        Оборот за {period === 'day' ? 'день' : period === 'month' ? 'месяц' : 'год'}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {stats.totalAmount.toLocaleString('ru-RU')} сом
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatPeriodLabel()}
                    </div>
                </div>

                {/* Доля сотрудника */}
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        Доля сотрудника
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stats.totalMaster.toLocaleString('ru-RU')} сом
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {stats.totalAmount > 0
                            ? `${((stats.totalMaster / stats.totalAmount) * 100).toFixed(1)}%`
                            : '0%'}
                    </div>
                </div>

                {/* Доля бизнеса */}
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        Доля бизнеса
                    </div>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {stats.totalSalon.toLocaleString('ru-RU')} сом
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {stats.totalAmount > 0
                            ? `${((stats.totalSalon / stats.totalAmount) * 100).toFixed(1)}%`
                            : '0%'}
                    </div>
                </div>
            </div>

            {/* Дополнительная информация */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                        Количество смен
                    </div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {stats.shiftsCount}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {stats.openShiftsCount > 0 && (
                            <span className="text-green-600 dark:text-green-400">
                                {stats.openShiftsCount} открыта
                            </span>
                        )}
                        {stats.openShiftsCount > 0 && stats.closedShiftsCount > 0 && ' • '}
                        {stats.closedShiftsCount > 0 && (
                            <span className="text-gray-600 dark:text-gray-400">
                                {stats.closedShiftsCount} закрыта
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                        Расходники
                    </div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalConsumables.toLocaleString('ru-RU')} сом
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                        Опоздания
                    </div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalLateMinutes} мин
                    </div>
                </div>
            </div>

            {/* Список смен */}
            {stats.shifts.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Смены за период
                    </h3>
                    <div className="space-y-3">
                        {stats.shifts.map((shift) => (
                            <div
                                key={shift.id}
                                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {formatDate(shift.shift_date)}
                                        </span>
                                        <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                                shift.status === 'open'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                            }`}
                                        >
                                            {shift.status === 'open' ? 'Открыта' : 'Закрыта'}
                                        </span>
                                    </div>
                                    {shift.opened_at && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            Открыта:{' '}
                                            {new Date(shift.opened_at).toLocaleTimeString('ru-RU', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right space-y-1">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        {shift.total_amount.toLocaleString('ru-RU')} сом
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Сотрудник: {shift.master_share.toLocaleString('ru-RU')} сом
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Бизнес: {shift.salon_share.toLocaleString('ru-RU')} сом
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

