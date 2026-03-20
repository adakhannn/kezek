'use client';

import { useState } from 'react';

import { useToast } from '@/hooks/useToast';
import { formatTime } from '@/lib/dateFormat';
import { logError } from '@/lib/log';
import type { Shift } from './staffFinanceStatsTypes';

type TranslationFn = (key: string, fallback: string) => string;

export function StaffFinanceShiftCard({
    shift,
    formatDate,
    locale,
    t,
}: {
    shift: Shift;
    formatDate: (dateStr: string) => string;
    locale: string;
    t: TranslationFn;
}) {
    const toast = useToast();
    const [isExpanded, setIsExpanded] = useState(shift.status === 'open');

    const formatItemTime = (iso: string | null) => {
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

    const handleEditHours = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        const current = shift.hours_worked ?? 0;
        const input = window.prompt(
            t(
                'finance.staffStats.editHoursPrompt',
                'Введите фактическое количество отработанных часов для этой смены'
            ),
            current.toFixed(2)
        );
        if (!input) return;

        const next = Number(input.replace(',', '.'));
        if (!Number.isFinite(next) || next < 0) {
            toast.showError(
                t('finance.staffStats.editHoursInvalid', 'Некорректное значение часов')
            );
            return;
        }

        try {
            const res = await fetch(`/api/dashboard/staff-shifts/${shift.id}/update-hours`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hours_worked: next }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
                throw new Error(json.error || `HTTP_${res.status}`);
            }
            window.location.reload();
        } catch (err) {
            logError('StaffFinanceStats', 'Failed to update shift hours', err);
            toast.showError(
                t(
                    'finance.staffStats.editHoursError',
                    'Не удалось обновить часы. Попробуйте позже.'
                )
            );
        }
    };

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
                            {t('finance.staffStats.openedAt', 'Открыта')}: {formatTime(shift.opened_at, locale as 'ru' | 'ky' | 'en')}
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
                                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                onClick={handleEditHours}
                            >
                                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15.232 5.232l3.536 3.536M9 11l4-4 6 6M5 19h4.586a1 1 0 00.707-.293l9.414-9.414a2 2 0 000-2.828l-2.172-2.172a2 2 0 00-2.828 0L5 13.586V19z"
                                    />
                                </svg>
                                <span>{t('finance.staffStats.editHours', 'Исправить часы')}</span>
                            </button>
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

            {isExpanded && shift.items.length > 0 && (
                <div className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
                    <div className="p-3">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                            {t('finance.staffStats.clientsList', 'Список клиентов')}
                        </h4>
                        <div className="space-y-2">
                            <div className="hidden sm:grid grid-cols-[2fr,2fr,1fr,1fr,1fr] gap-3 px-3 py-2 bg-gray-100 dark:bg-gray-800/50 rounded-lg text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                <span>{t('finance.staffStats.client', 'Клиент')}</span>
                                <span>{t('finance.staffStats.service', 'Услуга')}</span>
                                <span className="text-right">{t('finance.staffStats.amount', 'Сумма')}</span>
                                <span className="text-right">{t('finance.staffStats.consumables', 'Расходники')}</span>
                                <span className="text-right">{t('finance.staffStats.createdAt', 'Время заполнения')}</span>
                            </div>
                            {shift.items.map((item) => {
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
                                                {formatItemTime(item.created_at)}
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
