'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { formatDate, formatDateBrowser, formatMonthYear, formatTime } from '@/lib/dateFormat';
import type {
    StaffFinanceStatsPayload,
    StaffFinanceStatsPeriod,
    StaffFinanceStatsResponse,
    StaffFinanceStatsShift,
} from '@/lib/finance/types';
import { logDebug, logError } from '@/lib/log';
import { TZ } from '@/lib/time';

function ShiftCard({
    shift,
    formatDate,
    locale,
    t,
    onHoursUpdated,
}: {
    shift: StaffFinanceStatsShift;
    formatDate: (dateStr: string) => string;
    locale: string;
    t: (key: string, fallback: string) => string;
    onHoursUpdated?: () => void | Promise<void>;
}) {
    const toast = useToast();
    const [isExpanded, setIsExpanded] = useState(shift.status === 'open');
    const [isEditingHours, setIsEditingHours] = useState(false);
    const [hoursInput, setHoursInput] = useState(() => {
        const current = shift.hours_worked ?? 0;
        return Number.isFinite(current) ? current.toFixed(2) : '0.00';
    });
    const [isSavingHours, setIsSavingHours] = useState(false);

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
                            {formatTime(shift.opened_at, locale as 'ru' | 'ky' | 'en')}
                        </div>
                    )}
                </div>
                <div className="text-right mr-4 min-w-[160px]">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">
                        {shift.total_amount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                    </div>
                    <div className="text-[10px] leading-tight text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.consumables', 'Расходники')}:{' '}
                        {shift.consumables_amount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                    </div>
                    {/* Если есть гарантированная сумма и она больше базовой доли, показываем её как основную выплату */}
                    {shift.guaranteed_amount > 0 && shift.hourly_rate && shift.guaranteed_amount > shift.master_share ? (
                        <div className="space-y-0.5">
                            <div className="text-[10px] leading-tight text-emerald-600 dark:text-emerald-400">
                                {t('finance.staffStats.toEmployee', 'Сотруднику')}:{' '}
                                <span className="font-semibold">
                                    {shift.guaranteed_amount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                                </span>
                            </div>
                            {shift.hours_worked !== null && (
                                <div className="text-[10px] leading-tight text-amber-600 dark:text-amber-400">
                                    {t('finance.staffStats.guaranteedAmount', 'За выход')}: {shift.hours_worked.toFixed(1)} {t('finance.staffStats.hours', 'ч')}
                                </div>
                            )}
                            <div className="text-[10px] leading-tight text-gray-400 dark:text-gray-500 line-through">
                                {t('finance.staffStats.baseShare', 'Базовая')}: {shift.master_share.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                            </div>
                            <div className="text-[10px] leading-tight text-gray-500 dark:text-gray-400">
                                {t('finance.staffStats.toBusiness', 'Бизнесу')}: {shift.salon_share.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            <div className="text-[10px] leading-tight text-gray-500 dark:text-gray-400">
                                {t('finance.staffStats.toEmployee', 'Сотруднику')}: {shift.master_share.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                            </div>
                            {shift.guaranteed_amount > 0 && shift.hourly_rate && (
                                <div className="text-[10px] leading-tight text-gray-500 dark:text-gray-400">
                                    {t('finance.staffStats.guaranteedAmount', 'За выход')}: {shift.guaranteed_amount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                                    {shift.hours_worked !== null && (
                                        <span className="ml-1">({shift.hours_worked.toFixed(1)} {t('finance.staffStats.hours', 'ч')})</span>
                                    )}
                                </div>
                            )}
                            <div className="text-[10px] leading-tight text-gray-500 dark:text-gray-400">
                                {t('finance.staffStats.toBusiness', 'Бизнесу')}: {shift.salon_share.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом
                            </div>
                        </div>
                    )}
                    {shift.status === 'closed' && shift.hours_worked !== null && (
                        <div className="mt-1">
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
                                disabled={isSavingHours}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const current = shift.hours_worked ?? 0;
                                    setHoursInput(Number.isFinite(current) ? current.toFixed(2) : '0.00');
                                    setIsEditingHours((v) => !v);
                                }}
                            >
                                <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15.232 5.232l3.536 3.536M9 11l4-4 6 6M5 19h4.586a1 1 0 00.707-.293l9.414-9.414a2 2 0 000-2.828l-2.172-2.172a2 2 0 00-2.828 0L5 13.586V19z"
                                    />
                                </svg>
                                <span>
                                    {t(
                                        'finance.staffStats.editHours',
                                        'Исправить часы'
                                    )}
                                </span>
                            </button>
                            {isEditingHours && (
                                <div
                                    className="mt-2 flex flex-col gap-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            max={24}
                                            step={0.25}
                                            value={hoursInput}
                                            onChange={(e) => setHoursInput(e.target.value)}
                                            className="w-28 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
                                        />
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                            {t('finance.staffStats.hours', 'ч')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                            disabled={isSavingHours}
                                            onClick={async () => {
                                                const raw = hoursInput.trim().replace(',', '.');
                                                const next = Number(raw);
                                                if (!Number.isFinite(next) || next < 0 || next > 24) {
                                                    toast.showError(
                                                        t(
                                                            'finance.staffStats.editHoursInvalid',
                                                            'Некорректное значение часов'
                                                        )
                                                    );
                                                    return;
                                                }
                                                try {
                                                    setIsSavingHours(true);
                                                    const res = await fetch(
                                                        `/api/dashboard/staff-shifts/${shift.id}/update-hours`,
                                                        {
                                                            method: 'POST',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                            },
                                                            body: JSON.stringify({
                                                                hours_worked: next,
                                                            }),
                                                        }
                                                    );
                                                    const json = await res.json().catch(() => ({}));
                                                    if (!res.ok || !json.ok) {
                                                        throw new Error(json.error || `HTTP_${res.status}`);
                                                    }
                                                    setIsEditingHours(false);
                                                    await onHoursUpdated?.();
                                                } catch (err) {
                                                    logError('StaffFinanceStats', 'Failed to update shift hours', err);
                                                    toast.showError(
                                                        t(
                                                            'finance.staffStats.editHoursError',
                                                            'Не удалось обновить часы. Попробуйте позже.'
                                                        )
                                                    );
                                                } finally {
                                                    setIsSavingHours(false);
                                                }
                                            }}
                                        >
                                            {isSavingHours ? t('finance.loading', 'Загрузка...') : t('common.save', 'Сохранить')}
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                                            disabled={isSavingHours}
                                            onClick={() => setIsEditingHours(false)}
                                        >
                                            {t('common.cancel', 'Отмена')}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                        {t(
                                            'finance.staffStats.editHoursHint',
                                            'Введите фактические часы (0–24)'
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
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
                <div className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                    <div className="p-3">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                            {t('finance.staffStats.clientsList', 'Список клиентов')}
                        </h4>
                        <div className="space-y-2">
                            {/* Заголовок колонок */}
                            <div className="hidden sm:grid grid-cols-[2fr,2fr,1fr,1fr,1fr] gap-3 px-3 py-2 bg-gray-100 dark:bg-gray-800/50 rounded-lg text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                <span>{t('finance.staffStats.client', 'Клиент')}</span>
                                <span>{t('finance.staffStats.service', 'Услуга')}</span>
                                <span className="text-right">{t('finance.staffStats.amount', 'Сумма')}</span>
                                <span className="text-right">{t('finance.staffStats.consumables', 'Расходники')}</span>
                                <span className="text-right">{t('finance.staffStats.createdAt', 'Время заполнения')}</span>
                            </div>
                            {shift.items.map((item) => {
                                const formatTime = (iso: string | null) => {
                                    if (!iso) return '—';
                                    try {
                                        const d = new Date(iso);
                                        const localeMap: Record<string, string> = { ky: 'ky-KG', ru: 'ru-RU', en: 'en-US' };
                                        return d.toLocaleTimeString(localeMap[locale] || 'ru-RU', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        });
                                    } catch {
                                        return '—';
                                    }
                                };
                                
                                const hasBooking = !!item.booking_id;
                                
                                return (
                                    <div
                                        key={item.id}
                                        className="grid grid-cols-[2fr,2fr,1fr,1fr,1fr] gap-3 items-center py-2.5 px-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all"
                                    >
                                        <div className="min-w-0 flex items-center gap-2">
                                            {hasBooking && (
                                                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-green-500" title={t('staff.finance.clients.fromBooking', 'Из записи')} />
                                            )}
                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                                {item.client_name || t('finance.staffStats.clientNotSpecified', 'Клиент не указан')}
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                                {item.service_name || <span className="text-gray-400 italic">—</span>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-bold ${item.service_amount > 0 ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                                                {item.service_amount === 0 && !item.service_name
                                                    ? <span className="text-gray-400">—</span>
                                                    : `${item.service_amount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом`}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-sm font-semibold ${item.consumables_amount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}`}>
                                                {item.consumables_amount === 0
                                                    ? <span className="text-gray-400">0</span>
                                                    : `${item.consumables_amount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом`}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                {formatTime(item.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
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

export default function StaffFinanceStats({ staffId }: { staffId: string }) {
    const { t, locale } = useLanguage();
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<StaffFinanceStatsPeriod>('day');
    const [date, setDate] = useState(formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [stats, setStats] = useState<StaffFinanceStatsPayload | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // API для месяца ожидает date=YYYY-MM, для года — YYYY; для дня — YYYY-MM-DD
            const dateParam =
                period === 'year'
                    ? (date.split('-')[0] ?? date)
                    : period === 'month'
                        ? (date.length >= 7 ? date.substring(0, 7) : date)
                        : date.length === 7
                            ? `${date}-01`
                            : date.length === 4
                                ? `${date}-01-01`
                                : date;
            const url = `/api/dashboard/staff/${staffId}/finance/stats?period=${period}&date=${encodeURIComponent(dateParam)}`;
            logDebug('StaffFinanceStats', 'Loading stats', { url, staffId, period, date: dateParam });
            const res = await fetch(url, { cache: 'no-store' });
            const json = (await res.json()) as StaffFinanceStatsResponse;
            logDebug('StaffFinanceStats', 'Stats response', json);
            if (!json.ok) {
                throw new Error(json.error || t('finance.loading', 'Не удалось загрузить статистику'));
            }
            // API возвращает { ok: true, data: { stats } }, а не { ok: true, stats }
            const payload = (json as { data?: { stats?: StaffFinanceStatsPayload }; stats?: StaffFinanceStatsPayload }).data?.stats
                ?? (json as { stats?: StaffFinanceStatsPayload }).stats;
            setStats(payload ?? null);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            logError('StaffFinanceStats', 'Error loading stats', e);
        } finally {
            setLoading(false);
        }
    }, [staffId, period, date, t]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    const formatPeriodLabel = () => {
        if (period === 'day') {
            return formatDateBrowser(date, locale);
        } else if (period === 'month') {
            return formatMonthYear(date, locale);
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
            {/* Фильтры - компактный блок */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setPeriod('day')}
                        disabled={loading}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            period === 'day'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                        } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {t('finance.period.day', 'День')}
                    </button>
                    <button
                        onClick={() => setPeriod('month')}
                        disabled={loading}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            period === 'month'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                        } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {t('finance.period.month', 'Месяц')}
                    </button>
                    <button
                        onClick={() => setPeriod('year')}
                        disabled={loading}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            period === 'year'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                        } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {t('finance.period.year', 'Год')}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type={period === 'year' ? 'number' : period === 'month' ? 'month' : 'date'}
                        value={period === 'year' ? date.split('-')[0] : period === 'month' ? (date.substring(0, 7) || date) : date}
                        disabled={loading}
                        onChange={(e) => {
                            if (period === 'year') {
                                setDate(`${e.target.value}-01-01`);
                            } else if (period === 'month') {
                                setDate(e.target.value.length === 7 ? e.target.value + '-01' : e.target.value);
                            } else {
                                setDate(e.target.value);
                            }
                        }}
                        className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                        onClick={loadStats}
                        disabled={loading}
                        className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? t('finance.loading', 'Загрузка...') : t('finance.update', 'Обновить')}
                    </button>
                </div>
            </div>
            {/* Индикатор фоновой загрузки (без мигания контента) */}
            {loading && stats && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 -mt-2">
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                    <span>{t('finance.loading', 'Загрузка...')}</span>
                </div>
            )}

            {/* Основная статистика - ключевые метрики */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Оборот */}
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        {t('finance.staffStats.turnover', 'Оборот')}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {stats.totalAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-base text-gray-500">сом</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatPeriodLabel()}
                    </div>
                </div>

                {/* Доля сотрудника */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg border border-emerald-200 dark:border-emerald-800/50 p-5">
                    <div className="text-xs uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">
                        {t('finance.staffStats.toEmployee', 'Доля сотрудника')}
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                        {stats.totalMaster.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-base text-emerald-500">сом</span>
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
                        {stats.totalAmount > 0
                            ? `${((stats.totalMaster / stats.totalAmount) * 100).toFixed(1)}%`
                            : '0%'}
                    </div>
                    {/* Детальная разбивка расчета, если есть гарантированная оплата */}
                    {stats.hasGuaranteedPayment && stats.totalBaseMasterShare !== undefined && stats.totalGuaranteedAmount !== undefined && (
                        <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/50 space-y-1">
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-tight">
                                {t('finance.staffStats.baseShare', 'Базовая доля')}: <span className="font-medium">{stats.totalBaseMasterShare.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом</span>
                            </div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
                                {t('finance.staffStats.guaranteedAmount', 'За выход')}: <span className="font-medium">+{stats.totalGuaranteedAmount.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Доля бизнеса */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg border border-indigo-200 dark:border-indigo-800/50 p-5">
                    <div className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-2">
                        {t('finance.staffStats.toBusiness', 'Доля бизнеса')}
                    </div>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                        {stats.totalSalon.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-base text-indigo-500">сом</span>
                    </div>
                    <div className="text-xs text-indigo-600 dark:text-indigo-400">
                        {stats.totalAmount > 0
                            ? `${((stats.totalSalon / stats.totalAmount) * 100).toFixed(1)}%`
                            : '0%'}
                    </div>
                </div>
            </div>

            {/* Статус смены (для дня) - отдельный блок */}
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

            {/* Дополнительная информация - компактная сетка */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {t('finance.staffStats.shifts', 'Смен')}
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.shiftsCount}
                    </div>
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
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalConsumables.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} <span className="text-xs text-gray-500">сом</span>
                    </div>
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
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {stats.totalClients}
                    </div>
                </div>
            </div>

            {/* Список смен */}
            {stats.shifts.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-wide">
                        {t('finance.staffStats.shiftsPeriod', 'Смены за период')}
                    </h3>
                    <div className="space-y-2">
                        {stats.shifts.map((shift) => (
                            <ShiftCard
                                key={shift.id}
                                shift={shift}
                                formatDate={formatDate}
                                locale={locale}
                                t={t}
                                onHoursUpdated={loadStats}
                            />
                        ))}
                    </div>
                </div>
            )}
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}

