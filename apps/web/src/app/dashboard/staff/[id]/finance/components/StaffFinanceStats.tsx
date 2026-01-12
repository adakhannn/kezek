'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { TZ } from '@/lib/time';

type ShiftItem = {
    id: string;
    client_name: string;
    service_name: string;
    service_amount: number;
    consumables_amount: number;
    note: string | null;
    booking_id: string | null;
};

type Shift = {
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
    items: ShiftItem[];
};

function ShiftCard({
    shift,
    formatDate,
    locale,
    t,
}: {
    shift: Shift;
    formatDate: (dateStr: string) => string;
    locale: string;
    t: (key: string, fallback: string) => string;
}) {
    const [isExpanded, setIsExpanded] = useState(shift.status === 'open');

    return (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
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
                            {shift.status === 'open'
                                ? t('finance.staffStats.status.open', 'Открыта')
                                : t('finance.staffStats.status.closed', 'Закрыта')}
                        </span>
                        {shift.items.length > 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({shift.items.length} {t('finance.staffStats.clients', 'клиентов')})
                            </span>
                        )}
                    </div>
                    {shift.opened_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            {t('finance.staffStats.openedAt', 'Открыта')}
                            {': '}
                            {new Date(shift.opened_at).toLocaleTimeString(locale === 'en' ? 'en-US' : 'ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </div>
                    )}
                </div>
                <div className="text-right space-y-1 mr-4">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {shift.total_amount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t('finance.staffStats.toEmployee', 'Сотруднику')}:{' '}
                        {shift.master_share.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {t('finance.staffStats.toBusiness', 'Бизнесу')}:{' '}
                        {shift.salon_share.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                    </div>
                </div>
                <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                >
                    <svg
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {/* Список клиентов */}
            {isExpanded && shift.items.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                    <div className="p-4">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            {t('finance.staffStats.clientsList', 'Список клиентов')}
                        </h4>
                        <div className="space-y-2">
                            {/* Заголовок колонок */}
                            <div className="hidden sm:grid grid-cols-[2fr,2fr,1fr,1fr] gap-2 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                <span>{t('finance.staffStats.client', 'Клиент')}</span>
                                <span>{t('finance.staffStats.service', 'Услуга')}</span>
                                <span className="text-right">{t('finance.staffStats.amount', 'Сумма')}</span>
                                <span className="text-right">{t('finance.staffStats.consumables', 'Расходники')}</span>
                            </div>
                            {shift.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="grid grid-cols-[2fr,2fr,1fr,1fr] gap-2 items-center py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                            {item.client_name || t('finance.staffStats.clientNotSpecified', 'Клиент не указан')}
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                            {item.service_name || <span className="text-gray-400">—</span>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {item.service_amount === 0 && !item.service_name
                                                ? <span className="text-gray-400">—</span>
                                                : `${item.service_amount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом`}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {item.consumables_amount === 0
                                                ? <span className="text-gray-400">0</span>
                                                : `${item.consumables_amount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом`}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {isExpanded && shift.items.length === 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('finance.staffStats.noClients', 'Нет добавленных клиентов')}
                    </p>
                </div>
            )}
        </div>
    );
}

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
    totalClients: number;
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
        items: Array<{
            id: string;
            client_name: string;
            service_name: string;
            service_amount: number;
            consumables_amount: number;
            note: string | null;
            booking_id: string | null;
        }>;
    }>;
};

export default function StaffFinanceStats({ staffId }: { staffId: string }) {
    const { t, locale } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('day');
    const [date, setDate] = useState(formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [stats, setStats] = useState<Stats | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `/api/dashboard/staff/${staffId}/finance/stats?period=${period}&date=${date}`;
            console.log('[StaffFinanceStats] Loading stats:', { url, staffId, period, date });
            const res = await fetch(url, { cache: 'no-store' });
            const json = await res.json();
            console.log('[StaffFinanceStats] Stats response:', json);
            if (!json.ok) {
                throw new Error(json.error || t('finance.loading', 'Не удалось загрузить статистику'));
            }
            
            // Если есть открытая смена на сегодня, но мы смотрим на другую дату,
            // автоматически переключаемся на сегодня
            const today = formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
            if (period === 'day' && date !== today && json.stats?.openShiftsCount === 0) {
                // Проверяем, есть ли открытая смена на сегодня через отдельный запрос
                const todayRes = await fetch(
                    `/api/dashboard/staff/${staffId}/finance/stats?period=day&date=${today}`,
                    { cache: 'no-store' }
                );
                const todayJson = await todayRes.json();
                if (todayJson.ok && todayJson.stats?.openShiftsCount > 0) {
                    // Есть открытая смена на сегодня - переключаемся на сегодня
                    setDate(today);
                    // Загружаем данные для сегодня
                    const resToday = await fetch(
                        `/api/dashboard/staff/${staffId}/finance/stats?period=day&date=${today}`,
                        { cache: 'no-store' }
                    );
                    const jsonToday = await resToday.json();
                    if (jsonToday.ok) {
                        setStats(jsonToday.stats);
                        return;
                    }
                }
            }
            
            setStats(json.stats);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            console.error('[StaffFinanceStats] Error loading stats:', e);
        } finally {
            setLoading(false);
        }
    }, [staffId, period, date, t]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr + 'T12:00:00').toLocaleDateString(locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU', {
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
            return new Date(`${year}-${month}-01`).toLocaleDateString(locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU', {
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
                <div className="text-gray-500 dark:text-gray-400">{t('finance.loading', 'Загрузка...')}</div>
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
                        {t('finance.period.day', 'День')}
                    </button>
                    <button
                        onClick={() => setPeriod('month')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            period === 'month'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t('finance.period.month', 'Месяц')}
                    </button>
                    <button
                        onClick={() => setPeriod('year')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            period === 'year'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        {t('finance.period.year', 'Год')}
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
                        {loading ? t('finance.loading', 'Загрузка...') : t('finance.update', 'Обновить')}
                    </button>
                </div>
            </div>

            {/* Основная статистика */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Статус смены (для дня) */}
                {period === 'day' && (
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                            {t('finance.shifts', 'Смен')}
                        </div>
                        <div className="flex items-center gap-2">
                            {stats.openShiftsCount > 0 ? (
                                <>
                                    <span className="inline-flex h-3 w-3 rounded-full bg-green-500"></span>
                                    <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                                        {t('finance.staffStats.status.open', 'Смена открыта')}
                                    </span>
                                </>
                            ) : stats.closedShiftsCount > 0 ? (
                                <>
                                    <span className="inline-flex h-3 w-3 rounded-full bg-gray-400"></span>
                                    <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                                        {t('finance.staffStats.status.closed', 'Смена закрыта')}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="inline-flex h-3 w-3 rounded-full bg-amber-400"></span>
                                    <span className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                                        {t('finance.staffStats.status.noShift', 'Смена не открыта')}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Оборот */}
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        {t('finance.staffStats.turnover', 'Оборот')}{' '}
                        {period === 'day'
                            ? t('finance.period.day', 'День').toLowerCase()
                            : period === 'month'
                            ? t('finance.period.month', 'Месяц').toLowerCase()
                            : t('finance.period.year', 'Год').toLowerCase()}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {stats.totalAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatPeriodLabel()}
                    </div>
                </div>

                {/* Доля сотрудника */}
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        {t('finance.staffStats.toEmployee', 'Доля сотрудника')}
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {stats.totalMaster.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
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
                        {t('finance.staffStats.toBusiness', 'Доля бизнеса')}
                    </div>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {stats.totalSalon.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {stats.totalAmount > 0
                            ? `${((stats.totalSalon / stats.totalAmount) * 100).toFixed(1)}%`
                            : '0%'}
                    </div>
                </div>
            </div>

            {/* Дополнительная информация */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.shifts', 'Количество смен')}
                    </div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {stats.shiftsCount}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {stats.openShiftsCount > 0 && (
                            <span className="text-green-600 dark:text-green-400">
                                {stats.openShiftsCount}{' '}
                                {t('finance.shifts.open', 'открыта')}
                            </span>
                        )}
                        {stats.openShiftsCount > 0 && stats.closedShiftsCount > 0 && ' • '}
                        {stats.closedShiftsCount > 0 && (
                            <span className="text-gray-600 dark:text-gray-400">
                                {stats.closedShiftsCount}{' '}
                                {t('finance.shifts.closed', 'закрыта')}
                            </span>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.consumables', 'Расходники')}
                    </div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalConsumables.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.late', 'Опоздания')}
                    </div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalLateMinutes} мин
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.clients', 'Клиентов')}
                    </div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalClients}
                    </div>
                </div>
            </div>

            {/* Список смен */}
            {stats.shifts.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        {t('finance.staffStats.shiftsPeriod', 'Смены за период')}
                    </h3>
                    <div className="space-y-3">
                        {stats.shifts.map((shift) => (
                            <ShiftCard key={shift.id} shift={shift} formatDate={formatDate} locale={locale} t={t} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

