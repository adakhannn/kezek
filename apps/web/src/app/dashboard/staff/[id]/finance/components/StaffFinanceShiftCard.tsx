'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useState } from 'react';

import type { StaffFinanceStatsShift } from '@/lib/finance/types';
import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';

function formatMoney(value: number, locale: string) {
    return `${value.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} сом`;
}

export function StaffFinanceShiftCard({
    shift,
    locale,
    t,
    onHoursUpdated,
}: {
    shift: StaffFinanceStatsShift;
    locale: string;
    t: (key: string, fallback: string) => string;
    onHoursUpdated?: () => void | Promise<void>;
}) {
    const [isExpanded, setIsExpanded] = useState(shift.status === 'open');
    const [isEditingHours, setIsEditingHours] = useState(false);
    const [hoursInput, setHoursInput] = useState(() => {
        const current = shift.hours_worked ?? 0;
        return Number.isFinite(current) ? current.toFixed(2) : '0.00';
    });
    const [isSavingHours, setIsSavingHours] = useState(false);
    const [inlineError, setInlineError] = useState<string | null>(null);

    const shiftDate = formatInTimeZone(new Date(`${shift.shift_date}T12:00:00`), TZ, 'dd.MM.yyyy');
    const openedTime = shift.opened_at ? formatInTimeZone(new Date(shift.opened_at), TZ, 'HH:mm') : null;
    const closedTime = shift.closed_at ? formatInTimeZone(new Date(shift.closed_at), TZ, 'HH:mm') : null;
    const guaranteeDominates = shift.guaranteed_amount > 0 && shift.guaranteed_amount > shift.master_share;

    async function saveEditedHours() {
        const raw = hoursInput.trim().replace(',', '.');
        const nextValue = Number(raw);
        if (!Number.isFinite(nextValue) || nextValue < 0 || nextValue > 24) {
            setInlineError(t('finance.staffStats.editHoursInvalid', 'Invalid hours value'));
            return;
        }

        setInlineError(null);
        try {
            setIsSavingHours(true);
            const response = await fetch(`/api/dashboard/staff-shifts/${shift.id}/update-hours`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    hours_worked: nextValue,
                }),
            });
            const json = await response.json().catch(() => ({}));
            if (!response.ok || !json.ok) {
                throw new Error(json.error || `HTTP_${response.status}`);
            }
            setIsEditingHours(false);
            await onHoursUpdated?.();
        } catch (error) {
            logError('StaffFinanceShiftCard', 'Failed to update shift hours', error);
            setInlineError(t('finance.staffStats.editHoursError', 'Failed to update hours'));
        } finally {
            setIsSavingHours(false);
        }
    }

    return (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
            <button
                type="button"
                className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-[var(--surface-card)]"
                onClick={() => setIsExpanded((value) => !value)}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="type-label text-[var(--text-primary)]">{shiftDate}</p>
                        <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                shift.status === 'open'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                        >
                            {shift.status === 'open'
                                ? t('finance.staffStats.status.open', 'Open')
                                : t('finance.staffStats.status.closed', 'Closed')}
                        </span>
                        <span className="type-caption text-[var(--text-muted)]">
                            {shift.items.length} {t('finance.staffStats.clients', 'clients')}
                        </span>
                    </div>

                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                        {openedTime ? `${t('finance.staffStats.openedAt', 'Opened')}: ${openedTime}` : t('finance.shift.noOpenTime', 'No open time')}
                        {closedTime ? ` • ${t('finance.shift.closedAt', 'Closed')}: ${closedTime}` : ''}
                    </p>
                </div>

                <div className="min-w-[220px] space-y-1 text-right">
                    <p className="type-label text-[var(--text-primary)]">{formatMoney(shift.total_amount, locale)}</p>
                    <p className="type-caption text-[var(--text-muted)]">
                        {t('finance.staffStats.consumables', 'Consumables')}: {formatMoney(shift.consumables_amount, locale)}
                    </p>
                    <p className="type-caption text-emerald-600 dark:text-emerald-400">
                        {t('finance.staffStats.toEmployee', 'Employee')}: {formatMoney(guaranteeDominates ? shift.guaranteed_amount : shift.master_share, locale)}
                    </p>
                    <p className="type-caption text-indigo-600 dark:text-indigo-400">
                        {t('finance.staffStats.toBusiness', 'Business')}: {formatMoney(shift.salon_share, locale)}
                    </p>
                </div>

                <svg
                    className={`mt-1 h-5 w-5 flex-shrink-0 text-[var(--text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isExpanded ? (
                <div className="border-t border-[var(--border-subtle)] px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                            <p className="type-caption text-[var(--text-secondary)]">{t('finance.staffStats.baseShare', 'Base share')}</p>
                            <p className="type-label mt-1 text-[var(--text-primary)]">{formatMoney(shift.master_share, locale)}</p>
                        </div>
                        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                            <p className="type-caption text-[var(--text-secondary)]">{t('finance.staffStats.guaranteedAmount', 'Guarantee')}</p>
                            <p className="type-label mt-1 text-[var(--text-primary)]">{formatMoney(shift.guaranteed_amount, locale)}</p>
                        </div>
                        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                            <p className="type-caption text-[var(--text-secondary)]">{t('finance.staffStats.hours', 'Hours')}</p>
                            <p className="type-label mt-1 text-[var(--text-primary)]">{shift.hours_worked !== null ? shift.hours_worked.toFixed(2) : '—'}</p>
                        </div>
                    </div>

                    {shift.status === 'closed' ? (
                        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    className="rounded-[var(--radius-sm)] border border-[var(--border-default)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                                    disabled={isSavingHours}
                                    onClick={() => {
                                        const current = shift.hours_worked ?? 0;
                                        setHoursInput(Number.isFinite(current) ? current.toFixed(2) : '0.00');
                                        setInlineError(null);
                                        setIsEditingHours((value) => !value);
                                    }}
                                >
                                    {t('finance.staffStats.editHours', 'Adjust hours')}
                                </button>

                                {isEditingHours ? (
                                    <>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            max={24}
                                            step={0.25}
                                            value={hoursInput}
                                            onChange={(event) => setHoursInput(event.target.value)}
                                            className="h-8 w-24 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--surface-elevated)] px-2 text-xs text-[var(--text-primary)]"
                                        />
                                        <button
                                            type="button"
                                            className="rounded-[var(--radius-sm)] bg-[var(--accent-primary)] px-2.5 py-1 text-xs font-semibold text-[var(--text-inverse)] disabled:opacity-50"
                                            disabled={isSavingHours}
                                            onClick={() => {
                                                void saveEditedHours();
                                            }}
                                        >
                                            {isSavingHours ? t('finance.loading', 'Loading...') : t('common.save', 'Save')}
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-[var(--radius-sm)] border border-[var(--border-default)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]"
                                            disabled={isSavingHours}
                                            onClick={() => setIsEditingHours(false)}
                                        >
                                            {t('common.cancel', 'Cancel')}
                                        </button>
                                    </>
                                ) : null}
                            </div>
                            {inlineError ? <p className="type-caption mt-2 text-[var(--status-danger)]">{inlineError}</p> : null}
                        </div>
                    ) : null}

                    <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
                        <table className="min-w-full text-sm">
                            <thead className="bg-[var(--surface-card)]">
                                <tr className="text-left text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                    <th className="px-3 py-2">{t('finance.staffStats.client', 'Client')}</th>
                                    <th className="px-3 py-2">{t('finance.staffStats.service', 'Service')}</th>
                                    <th className="px-3 py-2 text-right">{t('finance.staffStats.amount', 'Amount')}</th>
                                    <th className="px-3 py-2 text-right">{t('finance.staffStats.consumables', 'Consumables')}</th>
                                    <th className="px-3 py-2 text-right">{t('finance.staffStats.createdAt', 'Created')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface-elevated)]">
                                {shift.items.length === 0 ? (
                                    <tr>
                                        <td className="px-3 py-4 text-center text-xs text-[var(--text-muted)]" colSpan={5}>
                                            {t('finance.staffStats.noClients', 'No client entries in this shift')}
                                        </td>
                                    </tr>
                                ) : (
                                    shift.items.map((item) => {
                                        const createdAt = item.created_at
                                            ? formatInTimeZone(new Date(item.created_at), TZ, 'HH:mm')
                                            : '—';
                                        return (
                                            <tr key={item.id}>
                                                <td className="px-3 py-2 text-[var(--text-primary)]">
                                                    {item.client_name || t('finance.staffStats.clientNotSpecified', 'Unknown')}
                                                </td>
                                                <td className="px-3 py-2 text-[var(--text-secondary)]">
                                                    {item.service_name || '—'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-[var(--text-primary)]">
                                                    {formatMoney(item.service_amount, locale)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-amber-500">
                                                    {formatMoney(item.consumables_amount, locale)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-[var(--text-muted)]">{createdAt}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
