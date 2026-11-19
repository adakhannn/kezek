'use client';

import { filterSlotsByContext, type Slot as ScheduleSlot } from '@core-domain/schedule';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { QuickDeskClientSection } from '@/app/dashboard/bookings/components/QuickDeskClientSection';
import { useQuickDeskClient } from '@/app/dashboard/bookings/components/useQuickDeskClient';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { createInternalBooking, getFreeSlotsForServiceDay } from '@/lib/bookingDashboardService';
import { TZ } from '@/lib/time';

function toYmdLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

type Service = { id: string; name: string; duration_min: number; branch_id: string };
type Branch = { id: string; name: string };

export default function Client({
    bizId,
    staffId,
    services,
    branches,
    defaultDate,
    staffName,
}: {
    bizId: string;
    staffId: string;
    services: Service[];
    branches: Branch[];
    defaultDate: string;
    staffName: string;
}) {
    const { t } = useLanguage();
    const toast = useToast();
    const client = useQuickDeskClient();
    const titleId = useId();
    // A click on a slot only selects it; the booking is created by the explicit confirmation
    // below, with a client (or an openly chosen walk-in). One stray click created an anonymous
    // confirmed booking before (FE-12).
    const [selectedStart, setSelectedStart] = useState('');
    const [creating, setCreating] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const inFlight = useRef(false);
    const panelRef = useRef<HTMLElement | null>(null);

    const [branchId, setBranchId] = useState('');
    const servicesByBranch = useMemo(
        () => (branchId ? services.filter((s) => s.branch_id === branchId) : []),
        [services, branchId],
    );

    const [serviceId, setServiceId] = useState('');
    const [date, setDate] = useState(defaultDate);

    const [slots, setSlots] = useState<ScheduleSlot[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const uniq = Array.from(new Map(slots.map((s) => [s.start_at, s])).values());

    useEffect(() => {
        setServiceId('');
        setSlots([]);
        setErr(null);
    }, [branchId]);

    useEffect(() => {
        setSelectedStart('');
    }, [branchId, serviceId, date]);

    useEffect(() => {
        if (selectedStart) panelRef.current?.scrollIntoView?.({ block: 'nearest' });
    }, [selectedStart]);

    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!branchId || !serviceId || !date) {
                setSlots([]);
                return;
            }
            setLoading(true);
            setErr(null);
            // Never show another day's or service's slots while loading or after a failure.
            setSlots([]);
            try {
                const raw = await getFreeSlotsForServiceDay({
                    bizId,
                    serviceId,
                    staffId,
                    day: date,
                    perStaff: 400,
                    stepMinutes: 15,
                });
                if (ignore) return;
                const all = (raw ?? []) as ScheduleSlot[];
                const now = new Date();
                const minTime = new Date(now.getTime() + 30 * 60 * 1000);

                const filtered = filterSlotsByContext(all, {
                    staffId,
                    branchId,
                    isTemporaryTransfer: false,
                    minStart: minTime,
                });
                setSlots(filtered);
                setSelectedStart((previous) => (previous && filtered.some((slot) => slot.start_at === previous) ? previous : ''));
            } catch (error) {
                // A failed load is an error, not "no free slots".
                if (!ignore) setErr(error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error));
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, serviceId, date, staffId, branchId, reloadKey]);

    const selectedSlot = uniq.find((slot) => slot.start_at === selectedStart) ?? null;
    const selectedService = servicesByBranch.find((service) => service.id === serviceId) ?? null;
    const selectedBranch = branches.find((branch) => branch.id === branchId) ?? null;
    const canConfirm = Boolean(selectedSlot && selectedService) && !loading && !creating && client.canSubmitClient;

    async function confirmBooking() {
        if (inFlight.current || !selectedSlot || !selectedService) return;
        const clientResult = client.getClientPayload(t);
        if (!clientResult.ok) {
            toast.showError(clientResult.error);
            return;
        }
        inFlight.current = true;
        setCreating(true);
        try {
            const bookingId = await createInternalBooking({
                bizId,
                branchId,
                serviceId: selectedService.id,
                staffId,
                startAtISO: selectedSlot.start_at,
                minutes: selectedService.duration_min,
                ...clientResult.payload,
            });
            toast.showSuccess(t('staff.slots.bookingCreated', 'Создана запись #{id}').replace('{id}', bookingId.slice(0, 8)));
            setSelectedStart('');
            client.reset();
        } catch (error: unknown) {
            // The selection and the client stay, so a retry sends the same booking.
            toast.showError(error instanceof Error ? error.message : String(error));
        } finally {
            inFlight.current = false;
            setCreating(false);
            // A taken slot disappears, and a booking whose response was lost shows up.
            setReloadKey((key) => key + 1);
        }
    }

    return (
        <>
            <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div>
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        {t('staff.slots.filters.title', 'Фильтры свободных слотов')}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('bookings.desk.branch', 'Филиал')}
                            </label>
                            <select
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                value={branchId}
                                disabled={creating}
                                onChange={(e) => setBranchId(e.target.value)}
                            >
                                <option value="">
                                    {t('bookings.desk.selectBranch', 'Выберите филиал')}
                                </option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('bookings.desk.service', 'Услуга')}
                            </label>
                            <select
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                disabled={!branchId || creating}
                                value={serviceId}
                                onChange={(e) => setServiceId(e.target.value)}
                            >
                                <option value="">
                                    {!branchId
                                        ? t('bookings.desk.selectBranchFirst', 'Сначала выберите филиал')
                                        : t('bookings.desk.selectService', 'Выберите услугу')}
                                </option>
                                {servicesByBranch.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} {t('staff.slots.serviceDuration', '({minutes} мин)').replace('{minutes}', String(s.duration_min))}
                                    </option>
                                ))}
                                {branchId && servicesByBranch.length === 0 && (
                                    <option value="">
                                        {t('bookings.desk.noServices', 'Нет услуг в филиале')}
                                    </option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('bookings.desk.date', 'Дата')}
                            </label>
                            <DatePickerPopover
                                value={date}
                                onChange={setDate}
                                min={toYmdLocal(new Date())}
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-200 pt-6 dark:border-gray-700">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('booking.freeSlots', 'Свободные слоты')}
                    </h3>

                    {loading && (
                        <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {t('booking.loadingSlots', 'Загружаем свободные слоты...')}
                        </div>
                    )}

                    {err ? (
                        <AlertBanner
                            variant="danger"
                            title={t('staff.error', 'Ошибка загрузки')}
                            message={err}
                        />
                    ) : null}

                    {!loading && !err && uniq.length === 0 && (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center dark:border-gray-700 dark:bg-gray-900">
                            <svg className="mx-auto mb-3 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                                {t('booking.noSlots', 'Нет свободных слотов')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                {t('staff.slots.noSlotsHint', 'Нет свободных слотов на выбранные параметры. Попробуйте выбрать другой день или услугу.')}
                            </p>
                        </div>
                    )}

                    {!loading && !err && uniq.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {t('staff.slots.found', 'Найдено свободных слотов:')}{' '}
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                        {uniq.length}
                                    </span>
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                                {uniq.map((s) => {
                                    const label = `${formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}–${formatInTimeZone(new Date(s.end_at), TZ, 'HH:mm')}`;
                                    const selected = s.start_at === selectedStart;
                                    return (
                                        <button
                                            key={s.start_at}
                                            type="button"
                                            aria-pressed={selected}
                                            disabled={creating}
                                            className={`group inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${selected
                                                ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                                                : 'border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40'}`}
                                            onClick={() => setSelectedStart(s.start_at)}
                                            title={t('staff.slots.selectSlot', 'Выбрать это время')}
                                        >
                                            <svg className="h-4 w-4 flex-shrink-0 text-indigo-500 group-hover:text-indigo-600 dark:text-indigo-400 dark:group-hover:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>{label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {selectedSlot && selectedService ? (
                        <section ref={panelRef} aria-labelledby={titleId} className="mt-6 space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-800 dark:bg-indigo-950/30">
                            <div>
                                <h3 id={titleId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                    {t('booking.confirm.title', 'Подтвердить запись')}
                                </h3>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    {t('booking.confirm.description', 'Проверьте детали. Запись будет создана только после подтверждения.')}
                                </p>
                            </div>
                            <dl className="grid gap-2 text-sm sm:grid-cols-2">
                                <div>
                                    <dt className="text-gray-500 dark:text-gray-400">{t('booking.confirm.when', 'Когда')}</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                                        {formatInTimeZone(new Date(selectedSlot.start_at), TZ, 'dd.MM.yyyy')}{' '}
                                        {formatInTimeZone(new Date(selectedSlot.start_at), TZ, 'HH:mm')}–{formatInTimeZone(new Date(selectedSlot.end_at), TZ, 'HH:mm')}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500 dark:text-gray-400">{t('booking.confirm.branch', 'Филиал')}</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">{selectedBranch?.name ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500 dark:text-gray-400">{t('booking.confirm.staff', 'Сотрудник')}</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">{staffName || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-gray-500 dark:text-gray-400">{t('bookings.desk.service', 'Услуга')}</dt>
                                    <dd className="font-medium text-gray-900 dark:text-gray-100">
                                        {selectedService.name} {t('staff.slots.serviceDuration', '({minutes} мин)').replace('{minutes}', String(selectedService.duration_min))}
                                    </dd>
                                </div>
                            </dl>
                            <QuickDeskClientSection
                                clientMode={client.clientMode}
                                setClientMode={client.setClientMode}
                                searchQ={client.searchQ}
                                setSearchQ={client.setSearchQ}
                                foundUsers={client.foundUsers}
                                selectedClientId={client.selectedClientId}
                                setSelectedClientId={client.setSelectedClientId}
                                newClientName={client.newClientName}
                                setNewClientName={client.setNewClientName}
                                newClientPhone={client.newClientPhone}
                                setNewClientPhone={client.setNewClientPhone}
                                searchLoading={client.searchLoading}
                                searchErr={client.searchErr}
                                t={t}
                            />
                            <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="secondary" onClick={() => setSelectedStart('')} disabled={creating}>
                                    {t('booking.confirm.cancel', 'Вернуться')}
                                </Button>
                                <Button onClick={() => void confirmBooking()} disabled={!canConfirm}>
                                    {creating ? t('booking.confirm.saving', 'Создаём запись…') : t('booking.confirm.submit', 'Подтвердить запись')}
                                </Button>
                            </div>
                        </section>
                    ) : null}
                </div>
            </section>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
