// apps/web/src/app/[slug]/view.tsx
'use client';

import { addDays, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { todayTz, dateAtTz, toLabel, TZ } from '@/lib/time';

type Biz = { id: string; slug: string; name: string; address: string; phones: string[] };
type Branch = { id: string; name: string };
type Service = {
    id: string;
    name_ru: string;
    duration_min: number;
    price_from?: number | null;
    price_to?: number | null;
    branch_id: string;
};
type Staff = { id: string; full_name: string; branch_id: string };

type Data = {
    biz: Biz;
    branches: Branch[];
    services: Service[];
    staff: Staff[];
};

type BookingRow = {
    start_at: string;
    end_at: string;
    staff_id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
};

// связь услуга ↔ мастер
type ServiceStaffRow = { service_id: string; staff_id: string; is_active: boolean };

// RPC get_free_slots_service_day_v2
type Slot = {
    staff_id: string;
    branch_id: string;
    start_at: string;
    end_at: string;
};

function fmtErr(e: unknown): string {
    if (e && typeof e === 'object') {
        const any = e as { message?: string; details?: string; hint?: string; code?: string };
        const rawMessage = any.message || '';

        // Пользовательский текст для частых бизнес-ошибок
        if (rawMessage.includes('is not assigned to branch')) {
            return 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.';
        }

        if (any.message) {
            const parts = [
                any.message,
                any.details && `Details: ${any.details}`,
                any.hint && `Hint: ${any.hint}`,
                any.code && `Code: ${any.code}`,
            ].filter(Boolean);
            return parts.join('\n');
        }
    }
    if (e instanceof Error) return e.message;
    try {
        return JSON.stringify(e);
    } catch {
        return String(e);
    }
}

export default function BizClient({ data }: { data: Data }) {
    const { biz, branches, services, staff } = data;

    /* ---------- auth ---------- */
    const [isAuthed, setIsAuthed] = useState<boolean>(false);
    useEffect(() => {
        let ignore = false;
        (async () => {
            const { data: auth } = await supabase.auth.getUser();
            if (!ignore) setIsAuthed(!!auth.user);
        })();
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
            setIsAuthed(!!s?.user);
        });
        return () => {
            ignore = true;
            sub.subscription.unsubscribe();
        };
    }, []);

    /* ---------- выбор филиала/услуги/мастера ---------- */
    const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? '');

    const servicesByBranch = useMemo(
        () => services.filter((s) => s.branch_id === branchId),
        [services, branchId]
    );
    const staffByBranch = useMemo(
        () => staff.filter((m) => m.branch_id === branchId),
        [staff, branchId]
    );

    const [serviceId, setServiceId] = useState<string>(servicesByBranch[0]?.id ?? '');
    const [staffId, setStaffId] = useState<string>(staffByBranch[0]?.id ?? '');
    const [restoredFromStorage, setRestoredFromStorage] = useState(false);

    // при смене филиала — сбрасываем выборы/слоты (если не восстановили состояние из localStorage)
    useEffect(() => {
        if (restoredFromStorage) return;
        setServiceId(servicesByBranch[0]?.id ?? '');
        setStaffId(staffByBranch[0]?.id ?? '');
    }, [branchId, servicesByBranch, staffByBranch, restoredFromStorage]);

    /* ---------- сервисные навыки мастеров (service_staff) ---------- */
    const [serviceStaff, setServiceStaff] = useState<ServiceStaffRow[] | null>(null);
    useEffect(() => {
        let ignore = false;
        (async () => {
            const { data, error } = await supabase
                .from('service_staff')
                .select('service_id,staff_id,is_active')
                .eq('is_active', true);
            if (ignore) return;
            if (error) {
                console.warn('[service_staff] read error:', error.message);
                setServiceStaff(null); // нет доступа — UI живёт без фильтра по навыкам
            } else {
                setServiceStaff((data ?? []) as ServiceStaffRow[]);
            }
        })();
        return () => {
            ignore = true;
        };
    }, []);

    // мапка service_id -> Set(staff_id)
    const serviceToStaffMap = useMemo(() => {
        if (!serviceStaff || serviceStaff.length === 0) return null;
        const map = new Map<string, Set<string>>();
        for (const row of serviceStaff) {
            if (!row.is_active) continue;
            if (!map.has(row.service_id)) map.set(row.service_id, new Set());
            map.get(row.service_id)!.add(row.staff_id);
        }
        return map;
    }, [serviceStaff]);

    // итоговый список мастеров: по филиалу + по навыку (если есть данные)
    const staffFiltered = useMemo<Staff[]>(() => {
        const base = staffByBranch;
        if (!serviceId) return base;
        if (!serviceToStaffMap) return base; // нет данных — не режем по навыку
        const allowed = serviceToStaffMap.get(serviceId);
        if (!allowed) return []; // услугу никто не умеет
        return base.filter((m) => allowed.has(m.id));
    }, [staffByBranch, serviceId, serviceToStaffMap]);

    // если выбранный мастер не подходит под новую услугу — мягко переезжаем на первого доступного
    useEffect(() => {
        if (!staffFiltered.find((m) => m.id === staffId)) {
            setStaffId(staffFiltered[0]?.id ?? '');
        }
    }, [serviceId, staffFiltered, staffId]);

    /* ---------- дата и слоты через RPC get_free_slots_service_day_v2 ---------- */
    const [day, setDay] = useState<Date>(todayTz());
    const dayStr = formatInTimeZone(day, TZ, 'yyyy-MM-dd');
    const todayStr = formatInTimeZone(todayTz(), TZ, 'yyyy-MM-dd');
    const maxStr = formatInTimeZone(addDays(todayTz(), 60), TZ, 'yyyy-MM-dd');

    const [slots, setSlots] = useState<Slot[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slotsError, setSlotsError] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!serviceId || !staffId || !dayStr) {
                setSlots([]);
                return;
            }
            setSlotsLoading(true);
            setSlotsError(null);
            try {
                const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
                    p_biz_id: biz.id,
                    p_service_id: serviceId,
                    p_day: dayStr,
                    p_per_staff: 400,
                    p_step_min: 15,
                });
                if (ignore) return;
                if (error) {
                    console.error('[get_free_slots_service_day_v2] error:', error);
                    setSlots([]);
                    setSlotsError(error.message);
                    return;
                }
                const all = (data ?? []) as Slot[];
                const filtered = all.filter(
                    (s) => s.staff_id === staffId && s.branch_id === branchId
                );
                setSlots(filtered);
            } catch (e) {
                if (ignore) return;
                console.error('[get_free_slots_service_day_v2] catch:', e);
                setSlots([]);
                setSlotsError(fmtErr(e));
            } finally {
                if (!ignore) setSlotsLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [biz.id, serviceId, staffId, branchId, dayStr]);

    /* ---------- hold / confirm и таймер ---------- */
    const [holding, setHolding] = useState<{ bookingId: string; until: number; slotLabel: string } | null>(null);
    const [guestSlotISO, setGuestSlotISO] = useState<string | null>(null);
    const [guestName, setGuestName] = useState<string>('');
    const [guestPhone, setGuestPhone] = useState<string>('');

    // Восстановление состояния после авторизации (localStorage)
    useEffect(() => {
        if (restoredFromStorage) return;
        if (typeof window === 'undefined') return;
        try {
            const key = `booking_state_${biz.id}`;
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                setRestoredFromStorage(true);
                return;
            }
            const parsed = JSON.parse(raw) as {
                branchId?: string;
                serviceId?: string;
                staffId?: string;
                day?: string;
                step?: number;
                guestSlotISO?: string | null;
            };

            if (parsed.branchId && branches.some((b) => b.id === parsed.branchId)) {
                setBranchId(parsed.branchId);
            }
            if (parsed.serviceId && services.some((s) => s.id === parsed.serviceId)) {
                setServiceId(parsed.serviceId);
            }
            if (parsed.staffId && staff.some((m) => m.id === parsed.staffId)) {
                setStaffId(parsed.staffId);
            }
            if (parsed.day) {
                try {
                    setDay(dateAtTz(parsed.day, '00:00'));
                } catch {
                    // ignore
                }
            }
            if (parsed.step && parsed.step >= 1 && parsed.step <= 4) {
                setStep(parsed.step);
            }
            if (parsed.guestSlotISO) {
                setGuestSlotISO(parsed.guestSlotISO);
            }

            window.localStorage.removeItem(key);
        } catch (e) {
            console.error('restore booking state failed', e);
        } finally {
            setRestoredFromStorage(true);
        }
    }, [biz.id, branches, services, staff, restoredFromStorage]);
    const [loading, setLoading] = useState(false);

    const service = useMemo(
        () => servicesByBranch.find((s) => s.id === serviceId) ?? null,
        [servicesByBranch, serviceId]
    );

    async function hold(t: Date) {
        if (!service) return alert('Выбери услугу');
        if (!staffId) return alert('Выбери мастера');
        if (!branchId) return alert('Выбери филиал');

        // Гость: не создаём бронь на hold, просто запоминаем выбранное время
        if (!isAuthed) {
            setGuestSlotISO(t.toISOString());
            setHolding(null);
            return;
        }

        setLoading(true);
        try {
            const startISO = formatInTimeZone(t, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
            const { data, error } = await supabase.rpc('hold_slot', {
                p_biz_id: biz.id,
                p_branch_id: branchId,
                p_service_id: service.id,
                p_staff_id: staffId,
                p_start: startISO,
            });

            if (error) {
                console.error('[hold_slot] error:', error);
                alert(fmtErr(error));
                return;
            }

            const bookingId = String(data);
            setHolding({ bookingId, until: Date.now() + 120_000, slotLabel: toLabel(t) });

            fetch('/api/notify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ type: 'hold', booking_id: bookingId }),
            }).catch(() => {});
        } catch (e) {
            console.error('[hold_slot] catch:', e);
            alert(fmtErr(e));
        } finally {
            setLoading(false);
        }
    }

    async function confirm() {
        if (!isAuthed || !holding) return;
        setLoading(true);
        try {
            const { error } = await supabase.rpc('confirm_booking', { p_booking_id: holding.bookingId });
            if (error) {
                console.error('[confirm_booking] error:', error);
                alert(fmtErr(error));
                return;
            }

            await fetch('/api/notify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ type: 'confirm', booking_id: holding.bookingId }),
            });

            location.href = `/booking/${holding.bookingId}`;
        } catch (e) {
            console.error('[confirm_booking] catch:', e);
            alert(fmtErr(e));
        } finally {
            setLoading(false);
        }
    }

    // таймер
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t0) => t0 + 1), 500);
        return () => clearInterval(id);
    }, []);
    const leftSec = Math.max(0, holding ? Math.ceil((holding.until - Date.now()) / 1000) : 0);
    void tick;

    /* ---------- производные значения для отображения ---------- */
    const branch = branches.find((b) => b.id === branchId) ?? null;
    const staffCurrent = staff.find((m) => m.id === staffId) ?? null;
    const serviceCurrent = service;

    const guestSlotLabel =
        guestSlotISO != null ? toLabel(new Date(guestSlotISO)) : null;

    function redirectToAuth() {
        if (typeof window === 'undefined') return;
        try {
            const key = `booking_state_${biz.id}`;
            const payload = {
                branchId,
                serviceId,
                staffId,
                day: dayStr,
                step,
                guestSlotISO,
            };
            window.localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {
            console.error('save booking state failed', e);
        }
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth/sign-in?mode=phone&redirect=${redirect}`;
    }

    const dayLabel = `${format(day, 'dd.MM.yyyy')} (${format(day, 'EEEE')})`;

    /* ---------- пошаговый визард ---------- */
    const [step, setStep] = useState<number>(1);
    const totalSteps = 4;

    const stepsMeta = [
        { id: 1, label: 'Филиал' },
        { id: 2, label: 'Услуга' },
        { id: 3, label: 'Мастер' },
        { id: 4, label: 'День и время' },
    ] as const;

    const canGoNext = step < totalSteps;
    const canGoPrev = step > 1;

    /* ---------- UI ---------- */
    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                        {biz.name}
                    </h1>
                    {biz.address && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{biz.address}</p>
                    )}
                    {biz.phones?.length ? (
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                            Телефон: {biz.phones.join(', ')}
                        </p>
                    ) : null}
                </div>

                {!isAuthed && (
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                        При желании вы можете войти через кнопку «Войти» вверху, чтобы видеть историю своих записей,
                        но это не обязательно — ниже можно записаться просто указав имя и номер телефона.
                    </div>
                )}

                {/* Степпер по шагам */}
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    {stepsMeta.map((s, index) => {
                        const isActive = s.id === step;
                        const isCompleted = s.id < step;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setStep(s.id)}
                                className="flex items-center gap-2"
                            >
                                <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                                        isActive
                                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                            : isCompleted
                                            ? 'border-emerald-500 bg-emerald-500 text-white'
                                            : 'border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300'
                                    }`}
                                >
                                    {isCompleted ? '✓' : s.id}
                                </div>
                                <span
                                    className={`text-[11px] font-medium ${
                                        isActive
                                            ? 'text-indigo-700 dark:text-indigo-300'
                                            : 'text-gray-600 dark:text-gray-300'
                                    }`}
                                >
                                    {index + 1}. {s.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                    <div className="space-y-4">
                        {/* Шаг 1: филиал */}
                        {step === 1 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Шаг 1. Выберите филиал
                                </h2>
                                {branches.length === 0 ? (
                                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                        Нет активных филиалов.
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {branches.map((b) => {
                                            const active = b.id === branchId;
                                            return (
                                                <button
                                                    key={b.id}
                                                    type="button"
                                                    onClick={() => setBranchId(b.id)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                                        active
                                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-100'
                                                            : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                                    }`}
                                                >
                                                    {b.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Шаг 2: услуга */}
                        {step === 2 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Шаг 2. Услуга
                                </h2>
                                {servicesByBranch.length === 0 ? (
                                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                        В этом филиале пока нет активных услуг.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {servicesByBranch.map((s) => {
                                            const active = s.id === serviceId;
                                            const hasRange =
                                                typeof s.price_from === 'number' &&
                                                (typeof s.price_to === 'number'
                                                    ? s.price_to !== s.price_from
                                                    : false);
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setServiceId(s.id)}
                                                    className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                                                        active
                                                            ? 'border-indigo-600 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60'
                                                            : 'border-gray-200 bg-white hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                                                            {s.name_ru}
                                                        </div>
                                                        <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                                            {s.duration_min} мин
                                                        </div>
                                                    </div>
                                                    {(typeof s.price_from === 'number' ||
                                                        typeof s.price_to === 'number') && (
                                                        <div className="whitespace-nowrap text-right text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                            {s.price_from}
                                                            {hasRange && s.price_to ? `–${s.price_to}` : ''}{' '}
                                                            сом
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {serviceCurrent && (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Продолжительность: {serviceCurrent.duration_min} мин.
                                        {serviceCurrent.price_from && (
                                            <>
                                                {' '}
                                                Примерная стоимость:{' '}
                                                {serviceCurrent.price_from}
                                                {serviceCurrent.price_to &&
                                                serviceCurrent.price_to !== serviceCurrent.price_from
                                                    ? `–${serviceCurrent.price_to}`
                                                    : ''}{' '}
                                                сом.
                                            </>
                                        )}
                                    </p>
                                )}
                            </section>
                        )}

                        {/* Шаг 3: мастер */}
                        {step === 3 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Шаг 3. Мастер
                                </h2>
                                {staffFiltered.length === 0 ? (
                                    <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                        Для выбранной услуги пока нет мастеров.
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {staffFiltered.map((m) => {
                                            const active = m.id === staffId;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => setStaffId(m.id)}
                                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                                        active
                                                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-100'
                                                            : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                                    }`}
                                                >
                                                    {m.full_name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Шаг 4: день и время */}
                        {step === 4 && (
                            <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Шаг 4. День и время
                                </h2>
                                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                                    <input
                                        type="date"
                                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                                        value={dayStr}
                                        min={todayStr}
                                        max={maxStr}
                                        onChange={(e) => {
                                            const v = e.target.value; // 'yyyy-MM-dd'
                                            if (!v) return;
                                            setDay(dateAtTz(v, '00:00'));
                                        }}
                                    />
                                    <button
                                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                                        onClick={() => setDay(todayTz())}
                                    >
                                        Сегодня
                                    </button>
                                    <button
                                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                                        onClick={() => setDay(addDays(todayTz(), 1))}
                                    >
                                        Завтра
                                    </button>
                                </div>

                                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    Свободные слоты
                                </h3>
                                {slotsLoading && (
                                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                        Загружаем свободные слоты...
                                    </div>
                                )}
                                {!slotsLoading && slotsError && (
                                    <div className="rounded-lg border border-dashed border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
                                        {slotsError}
                                    </div>
                                )}
                                {!slotsLoading && !slotsError && slots.length === 0 && (
                                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                                        Нет свободных окон на этот день. Попробуйте выбрать другой день или мастера.
                                    </div>
                                )}
                                {!slotsLoading && !slotsError && slots.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {slots.map((s) => {
                                            const d = new Date(s.start_at);
                                            return (
                                                <button
                                                    key={s.start_at}
                                                    disabled={loading}
                                                    className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40"
                                                    onClick={() => hold(d)}
                                                >
                                                    {toLabel(d)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Навигация по шагам */}
                        <div className="flex justify-between pt-1 text-xs">
                            <button
                                type="button"
                                disabled={!canGoPrev}
                                onClick={() => canGoPrev && setStep(step - 1)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                    canGoPrev
                                        ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'
                                        : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                ← Назад
                            </button>
                            <button
                                type="button"
                                disabled={!canGoNext}
                                onClick={() => canGoNext && setStep(step + 1)}
                                className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                    canGoNext
                                        ? 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-400'
                                        : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed'
                                }`}
                            >
                                {step === totalSteps - 1 ? 'К выбору времени →' : 'Далее →'}
                            </button>
                        </div>
                    </div>

                    {/* Корзина / итог */}
                    <aside className="space-y-3 rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Ваша запись
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Шаги слева → выберите услугу, мастера, день и время. Здесь вы увидите итог перед
                            подтверждением.
                        </p>

                        <div className="mt-2 space-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">Филиал:</span>
                                <span className="font-medium">{branch ? branch.name : 'Не выбран'}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">Услуга:</span>
                                <span className="text-right font-medium">
                                    {serviceCurrent ? serviceCurrent.name_ru : 'Не выбрана'}
                                </span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">Мастер:</span>
                                <span className="text-right font-medium">
                                    {staffCurrent ? staffCurrent.full_name : 'Не выбран'}
                                </span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">День:</span>
                                <span className="text-right font-medium">{dayLabel}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-gray-500">Время:</span>
                                <span className="text-right font-medium">
                                    {holding ? holding.slotLabel : guestSlotLabel ?? 'Выберите слот'}
                                </span>
                            </div>
                            {serviceCurrent?.price_from && (
                                <div className="mt-1 flex justify-between gap-2 border-t border-dashed border-gray-300 pt-1 dark:border-gray-700">
                                    <span className="text-gray-500">Ориентировочная стоимость:</span>
                                    <span className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                        {serviceCurrent.price_from}
                                        {serviceCurrent.price_to &&
                                        serviceCurrent.price_to !== serviceCurrent.price_from
                                            ? `–${serviceCurrent.price_to}`
                                            : ''}{' '}
                                        сом
                                    </span>
                                </div>
                            )}
                        </div>

                        {!holding && !guestSlotISO && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                Сначала выберите свободный слот, затем вы сможете подтвердить бронь.
                            </div>
                        )}

                        {/* Гостевой режим: без авторизации, но с телефоном/именем */}
                        {!isAuthed && guestSlotISO && (
                                <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                                <div className="font-semibold text-gray-900 dark:text-gray-100">
                                    Запись без регистрации
                                </div>
                                <p className="text-[11px] text-gray-600 dark:text-gray-400">
                                    Укажите имя и номер телефона, чтобы мастер мог связаться с вами при необходимости.
                                    Или авторизуйтесь, чтобы видеть свои записи в личном кабинете.
                                </p>
                                <div className="space-y-1.5">
                                    <input
                                        type="text"
                                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                                        placeholder="Имя (необязательно, но желательно)"
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                    />
                                    <input
                                        type="tel"
                                        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                                        placeholder="Телефон (обязательно)"
                                        value={guestPhone}
                                        onChange={(e) => setGuestPhone(e.target.value)}
                                    />
                                </div>
                                <div className="mt-2 flex flex-col gap-2">
                                    <button
                                        type="button"
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-800 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                                        onClick={redirectToAuth}
                                    >
                                        Войти или зарегистрироваться
                                    </button>
                                    <button
                                        className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                                        onClick={async () => {
                                        if (!serviceCurrent) {
                                            alert('Выбери услугу');
                                            return;
                                        }
                                        if (!branchId) {
                                            alert('Выбери филиал');
                                            return;
                                        }
                                        if (!staffId) {
                                            alert('Выбери мастера');
                                            return;
                                        }
                                        if (!guestSlotISO) {
                                            alert('Выбери слот');
                                            return;
                                        }
                                        if (!guestPhone.trim()) {
                                            alert('Укажи номер телефона');
                                            return;
                                        }

                                        setLoading(true);
                                        try {
                                            const startISO = formatInTimeZone(
                                                new Date(guestSlotISO),
                                                TZ,
                                                "yyyy-MM-dd'T'HH:mm:ssXXX"
                                            );
                                            const res = await fetch('/api/public/bookings/guest-create', {
                                                method: 'POST',
                                                headers: { 'content-type': 'application/json' },
                                                body: JSON.stringify({
                                                    biz_id: biz.id,
                                                    branch_id: branchId,
                                                    service_id: serviceCurrent.id,
                                                    staff_id: staffId,
                                                    start_at: startISO,
                                                    duration_min: serviceCurrent.duration_min,
                                                    client_name: guestName || null,
                                                    client_phone: guestPhone || null,
                                                }),
                                            });
                                            const json = (await res.json().catch(() => ({}))) as {
                                                ok?: boolean;
                                                booking_id?: string;
                                                message?: string;
                                                error?: string;
                                            };
                                            if (!res.ok || !json.ok || !json.booking_id) {
                                                alert(json.message || json.error || 'Не удалось создать запись');
                                                return;
                                            }
                                            location.href = `/booking/${json.booking_id}`;
                                        } catch (e) {
                                            console.error('guest booking error', e);
                                            alert('Ошибка при создании записи');
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                        disabled={loading}
                                    >
                                        Записаться без регистрации
                                    </button>
                                </div>
                            </div>
                        )}

                        {holding && (
                            <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-100">
                                <div className="flex items-center justify-between">
                                    <span>
                                        Слот удержан ещё{' '}
                                        <b>
                                            {leftSec}
                                        </b>{' '}
                                        сек.
                                    </span>
                                </div>
                                {isAuthed ? (
                                    <button
                                        className="mt-1 w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                                        onClick={confirm}
                                        disabled={loading}
                                    >
                                        Подтвердить бронь
                                    </button>
                                ) : (
                                    <button
                                        className="mt-1 w-full rounded-lg border border-indigo-400 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo-900 shadow-sm hover:bg-indigo-50 dark:bg-indigo-900 dark:text-indigo-50 dark:hover:bg-indigo-800"
                                        onClick={redirectToAuth}
                                    >
                                        Войти, чтобы подтвердить
                                    </button>
                                )}
                                <div className="text-[11px] text-indigo-900/80 dark:text-indigo-100/80">
                                    Пока без онлайн-оплаты. После добавления оплаты бронь будет подтверждаться
                                    автоматически.
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </main>
    );
}
