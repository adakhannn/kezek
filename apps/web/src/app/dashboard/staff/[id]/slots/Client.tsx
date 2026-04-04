'use client';

import { filterSlotsByContext, type Slot as ScheduleSlot } from '@core-domain/schedule';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import { AlertBanner } from '@/components/ui/AlertBanner';
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
}: {
    bizId: string;
    staffId: string;
    services: Service[];
    branches: Branch[];
    defaultDate: string;
}) {
    const { t, locale } = useLanguage();
    const toast = useToast();

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
        let ignore = false;
        (async () => {
            if (!branchId || !serviceId || !date) {
                setSlots([]);
                return;
            }
            setLoading(true);
            setErr(null);
            try {
                const raw = await getFreeSlotsForServiceDay({
                    bizId,
                    serviceId,
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
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, serviceId, date, staffId, branchId]);

    async function createBooking(startISO: string) {
        const svc = services.find((s) => s.id === serviceId);
        if (!svc) {
            toast.showError(t('bookings.desk.errors.selectService', 'РќРµ РЅР°Р№РґРµРЅР° СѓСЃР»СѓРіР°'));
            return;
        }

        try {
            const bookingId = await createInternalBooking({
                bizId,
                branchId,
                serviceId,
                staffId,
                startAtISO: startISO,
                minutes: svc.duration_min,
                clientId: null,
                clientName: null,
                clientPhone: null,
            });
            toast.showSuccess(
                `${t('bookings.desk.created', 'РЎРѕР·РґР°РЅР° Р·Р°РїРёСЃСЊ')} #${bookingId.slice(0, 8)}`,
            );
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            toast.showError(message);
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
                        {t('staff.slots.filters.title', 'Р¤РёР»СЊС‚СЂС‹ СЃРІРѕР±РѕРґРЅС‹С… СЃР»РѕС‚РѕРІ')}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('bookings.desk.branch', 'Р¤РёР»РёР°Р»')}
                            </label>
                            <select
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                            >
                                <option value="">
                                    {t('bookings.desk.selectBranch', 'Р’С‹Р±РµСЂРёС‚Рµ С„РёР»РёР°Р»')}
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
                                {t('bookings.desk.service', 'РЈСЃР»СѓРіР°')}
                            </label>
                            <select
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                disabled={!branchId}
                                value={serviceId}
                                onChange={(e) => setServiceId(e.target.value)}
                            >
                                <option value="">
                                    {!branchId
                                        ? t('bookings.desk.selectBranchFirst', 'РЎРЅР°С‡Р°Р»Р° РІС‹Р±РµСЂРёС‚Рµ С„РёР»РёР°Р»')
                                        : t('bookings.desk.selectService', 'Р’С‹Р±РµСЂРёС‚Рµ СѓСЃР»СѓРіСѓ')}
                                </option>
                                {servicesByBranch.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} {locale === 'en' ? `(${s.duration_min} min)` : `(${s.duration_min} РјРёРЅ)`}
                                    </option>
                                ))}
                                {branchId && servicesByBranch.length === 0 && (
                                    <option value="">
                                        {t('bookings.desk.noServices', 'РќРµС‚ СѓСЃР»СѓРі РІ С„РёР»РёР°Р»Рµ')}
                                    </option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('bookings.desk.date', 'Р”Р°С‚Р°')}
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
                        {t('booking.freeSlots', 'РЎРІРѕР±РѕРґРЅС‹Рµ СЃР»РѕС‚С‹')}
                    </h3>

                    {loading && (
                        <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {t('booking.loadingSlots', 'Р—Р°РіСЂСѓР¶Р°РµРј СЃРІРѕР±РѕРґРЅС‹Рµ СЃР»РѕС‚С‹...')}
                        </div>
                    )}

                    {err ? (
                        <AlertBanner
                            variant="danger"
                            title={t('staff.error', 'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё')}
                            message={err}
                        />
                    ) : null}

                    {!loading && !err && uniq.length === 0 && (
                        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center dark:border-gray-700 dark:bg-gray-900">
                            <svg className="mx-auto mb-3 h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-400">
                                {t('booking.noSlots', 'РќРµС‚ СЃРІРѕР±РѕРґРЅС‹С… СЃР»РѕС‚РѕРІ')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                                {t('staff.slots.noSlotsHint', 'РќРµС‚ СЃРІРѕР±РѕРґРЅС‹С… СЃР»РѕС‚РѕРІ РЅР° РІС‹Р±СЂР°РЅРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹. РџРѕРїСЂРѕР±СѓР№С‚Рµ РІС‹Р±СЂР°С‚СЊ РґСЂСѓРіРѕР№ РґРµРЅСЊ РёР»Рё СѓСЃР»СѓРіСѓ.')}
                            </p>
                        </div>
                    )}

                    {!loading && !err && uniq.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {t('staff.slots.found', 'РќР°Р№РґРµРЅРѕ СЃРІРѕР±РѕРґРЅС‹С… СЃР»РѕС‚РѕРІ:')}{' '}
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                        {uniq.length}
                                    </span>
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                                {uniq.map((s) => {
                                    const label = `${formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}вЂ“${formatInTimeZone(new Date(s.end_at), TZ, 'HH:mm')}`;
                                    return (
                                        <button
                                            key={s.start_at}
                                            className="group inline-flex items-center gap-2 rounded-xl border-2 border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md active:scale-95 dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40"
                                            onClick={() => createBooking(s.start_at)}
                                            title={t('staff.slots.createInSlot', 'РЎРѕР·РґР°С‚СЊ Р·Р°РїРёСЃСЊ РІ СЌС‚РѕС‚ СЃР»РѕС‚')}
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
                </div>
            </section>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
