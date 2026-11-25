'use client';

import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import {
    loadRescheduleSlots,
    postBookingReschedule,
    rescheduleDays,
    type RescheduleSlot,
} from '@/lib/bookingRescheduleClient';
import { formatLocalizedDate } from '@/lib/kyDateFormat';
import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type SlotsState =
    | { day: string; status: 'loading' }
    | { day: string; status: 'ready'; slots: RescheduleSlot[] }
    | { day: string; status: 'error' };

/** Moves the client's own booking to another free start of the same master (POST /api/bookings/[id]/reschedule). */
export default function RescheduleDialog({
    open,
    onClose,
    onRescheduled,
    booking,
}: {
    open: boolean;
    onClose: () => void;
    onRescheduled: () => void;
    booking: { id: string; bizId: string; branchId: string; staffId: string; startAt: string; durationMin: number; timeZone: string };
}) {
    const { t, locale } = useLanguage();
    const days = useMemo(() => rescheduleDays(booking.timeZone), [booking.timeZone]);
    const [day, setDay] = useState(days[0]);
    const [slotsState, setSlotsState] = useState<SlotsState>({ day: days[0], status: 'loading' });
    const [selected, setSelected] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setSlotsState({ day, status: 'loading' });
        loadRescheduleSlots(supabase, booking, day)
            .then((slots) => { if (!cancelled) setSlotsState({ day, status: 'ready', slots }); })
            .catch((reason: unknown) => {
                if (cancelled) return;
                logWarn('RescheduleDialog', 'Failed to load slots', reason);
                setSlotsState({ day, status: 'error' });
            });
        return () => { cancelled = true; };
    }, [open, day, booking, reloadKey]);

    const formatDay = (value: string) => formatLocalizedDate(new Date(`${value}T12:00:00Z`), locale,
        { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    const formatTime = (value: string) => formatLocalizedDate(new Date(value), locale,
        { hour: '2-digit', minute: '2-digit', timeZone: booking.timeZone });

    async function submit() {
        if (!selected) return;
        setSubmitting(true);
        setError(null);
        try {
            const outcome = await postBookingReschedule(booking.id, selected);
            if (outcome.ok) {
                onRescheduled();
                return;
            }
            setError(outcome.message ?? t('cabinet.bookings.reschedule.error', 'Не удалось перенести запись'));
            if (outcome.error === 'booking_slot_unavailable') {
                setSelected(null);
                setReloadKey((key) => key + 1);
            }
        } catch (reason) {
            logWarn('RescheduleDialog', 'Reschedule request failed', reason);
            setError(t('cabinet.bookings.reschedule.error', 'Не удалось перенести запись'));
        } finally {
            setSubmitting(false);
        }
    }

    const current = slotsState.day === day ? slotsState : { day, status: 'loading' as const };

    return (
        <Dialog
            open={open}
            onClose={() => { if (!submitting) onClose(); }}
            dismissible={!submitting}
            size="lg"
            title={t('cabinet.bookings.reschedule.title', 'Перенести запись')}
            description={t('cabinet.bookings.reschedule.description', 'Выберите новый день и время. Мастер, филиал и услуги останутся прежними.')}
            footer={
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                        {t('cabinet.bookings.reschedule.keep', 'Не переносить')}
                    </Button>
                    <Button type="button" variant="primary" onClick={submit} disabled={!selected || submitting} isLoading={submitting}>
                        {t('cabinet.bookings.reschedule.confirm', 'Перенести')}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <div>
                    <p className="type-label mb-2 text-[var(--text-secondary)]">{t('cabinet.bookings.reschedule.day', 'День')}</p>
                    <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label={t('cabinet.bookings.reschedule.day', 'День')}>
                        {days.map((value) => (
                            <Button
                                key={value}
                                type="button"
                                size="sm"
                                variant={value === day ? 'primary' : 'outline'}
                                aria-selected={value === day}
                                role="option"
                                onClick={() => { setDay(value); setSelected(null); setError(null); }}
                            >
                                {formatDay(value)}
                            </Button>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="type-label mb-2 text-[var(--text-secondary)]">{t('cabinet.bookings.reschedule.time', 'Время')}</p>
                    {current.status === 'loading' ? (
                        <p className="type-body text-[var(--text-muted)]">{t('cabinet.bookings.reschedule.loading', 'Загружаем свободное время...')}</p>
                    ) : current.status === 'error' ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <p className="type-body text-[var(--status-danger)]">{t('cabinet.bookings.reschedule.loadError', 'Не удалось загрузить свободное время.')}</p>
                            <Button type="button" size="sm" variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
                                {t('cabinet.bookings.reschedule.retry', 'Повторить')}
                            </Button>
                        </div>
                    ) : current.slots.length === 0 ? (
                        <p className="type-body text-[var(--text-muted)]">{t('cabinet.bookings.reschedule.empty', 'На этот день свободного времени нет. Выберите другой день.')}</p>
                    ) : (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="listbox" aria-label={t('cabinet.bookings.reschedule.time', 'Время')}>
                            {current.slots.map((slot) => (
                                <Button
                                    key={slot.start_at}
                                    type="button"
                                    size="sm"
                                    variant={selected === slot.start_at ? 'primary' : 'outline'}
                                    role="option"
                                    aria-selected={selected === slot.start_at}
                                    onClick={() => { setSelected(slot.start_at); setError(null); }}
                                >
                                    {formatTime(slot.start_at)}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
                {error ? <p role="alert" className="type-body text-[var(--status-danger)]">{error}</p> : null}
            </div>
        </Dialog>
    );
}
