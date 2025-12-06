// apps/web/src/app/[slug]/view.tsx
'use client';

import { addDays, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import { formatError } from '@/lib/errors';
import { supabase } from '@/lib/supabaseClient';
import { todayTz, dateAtTz, enumerateSlots, toLabel, TZ } from '@/lib/time';

type Biz = { id: string; name: string; address: string; phones: string[] };
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


const AuthPanelLazy = dynamic(() => import('@/components/auth/AuthPanel'), { ssr: false });

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

    const redirectToAuth = () => {
        const redirect = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/auth/sign-in?mode=phone&redirect=${redirect}`;
    };

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

    // при смене филиала — сбрасываем выборы/слоты
    useEffect(() => {
        setServiceId(servicesByBranch[0]?.id ?? '');
        setStaffId(staffByBranch[0]?.id ?? '');
    }, [branchId, servicesByBranch, staffByBranch]);

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

    /* ---------- дата ---------- */
    const [day, setDay] = useState<Date>(todayTz());
    const dayStr = formatInTimeZone(day, TZ, 'yyyy-MM-dd');
    const todayStr = formatInTimeZone(todayTz(), TZ, 'yyyy-MM-dd');
    const maxStr = formatInTimeZone(addDays(todayTz(), 60), TZ, 'yyyy-MM-dd');

    /* ---------- интервалы и занятость ---------- */
    const [intervals, setIntervals] = useState<{ start: string; end: string }[]>([]);
    const [busy, setBusy] = useState<Set<number>>(new Set());

    // рабочие интервалы на конкретный день недели
    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!staffId) {
                setIntervals([]);
                return;
            }
            const dowIso = Number(format(day, 'i')); // 1..7
            const dowDb = dowIso % 7; // 0..6
            const { data: wh, error } = await supabase
                .from('working_hours')
                .select('intervals,breaks')
                .eq('biz_id', biz.id)
                .eq('staff_id', staffId)
                .eq('day_of_week', dowDb);

            if (ignore) return;
            if (error) {
                console.error(error);
                setIntervals([]);
                return;
            }
            const merged = (wh?.[0]?.intervals ?? []) as { start: string; end: string }[];
            setIntervals(merged);
        })();
        return () => {
            ignore = true;
        };
    }, [biz.id, staffId, day]);

    // занятые минуты по броням в выбранный день
    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!staffId) {
                setBusy(new Set());
                return;
            }
            const startDay = formatInTimeZone(day, TZ, "yyyy-MM-dd'T'00:00:00XXX");
            const endDay = formatInTimeZone(addDays(day, 1), TZ, "yyyy-MM-dd'T'00:00:00XXX");

            const { data, error } = await supabase
                .from('bookings')
                .select('start_at,end_at,staff_id,status')
                .eq('biz_id', biz.id)
                .eq('staff_id', staffId)
                .in('status', ['hold', 'confirmed', 'paid'])
                .gte('start_at', startDay)
                .lt('start_at', endDay);

            if (ignore) return;
            if (error) {
                console.error(error);
                setBusy(new Set());
                return;
            }

            const set = new Set<number>();
            for (const b of (data ?? []) as BookingRow[]) {
                const s = new Date(b.start_at);
                const e = new Date(b.end_at);
                const base = new Date(formatInTimeZone(day, TZ, "yyyy-MM-dd'T'00:00:00XXX"));
                const m0 = Math.floor((s.getTime() - base.getTime()) / 60000);
                const m1 = Math.floor((e.getTime() - base.getTime()) / 60000);
                for (let m = m0; m < m1; m++) set.add(m);
            }
            setBusy(set);
        })();
        return () => {
            ignore = true;
        };
    }, [biz.id, staffId, day]);

    /* ---------- слоты ---------- */
    const service = servicesByBranch.find((s) => s.id === serviceId);

    const slots = useMemo<Date[]>(() => {
        if (!service || intervals.length === 0) return [];
        if (!staffId) return [];
        const res: Date[] = [];
        const base = new Date(formatInTimeZone(day, TZ, "yyyy-MM-dd'T'00:00:00XXX"));

        for (const win of intervals) {
            const winStart = dateAtTz(dayStr, win.start);
            const winEnd = dateAtTz(dayStr, win.end);
            const enumed = enumerateSlots(winStart, winEnd, service.duration_min, 15);

            for (const t of enumed) {
                const startM = Math.floor((t.getTime() - base.getTime()) / 60000);
                const endM = startM + service.duration_min;
                let ok = true;
                for (let m = startM; m < endM; m++) {
                    if (busy.has(m)) {
                        ok = false;
                        break;
                    }
                }
                if (ok) res.push(t);
            }
        }
        return res;
    }, [intervals, service, busy, staffId, day, dayStr]);

    /* ---------- hold / confirm и таймер ---------- */
    const [holding, setHolding] = useState<{ bookingId: string; until: number } | null>(null);
    const [loading, setLoading] = useState(false);

    async function hold(t: Date) {
        if (!isAuthed) return redirectToAuth();
        if (!service) return alert('Выбери услугу');
        if (!staffId) return alert('Выбери мастера');
        if (!branchId) return alert('Выбери филиал');

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
                alert(formatError(error));
                return;
            }

            const bookingId = String(data);
            setHolding({ bookingId, until: Date.now() + 120_000 });

            fetch('/api/notify', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ type: 'hold', booking_id: bookingId }),
            }).catch(() => {});
        } catch (e) {
            console.error('[hold_slot] catch:', e);
            alert(formatError(e));
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
                alert(formatError(error));
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
            alert(formatError(e));
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

    /* ---------- UI ---------- */
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Заголовок */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{biz.name}</h1>
                            {biz.address && (
                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>{biz.address}</span>
                                </div>
                            )}
                        </div>
                        <AuthPanelLazy />
                    </div>
                </div>

                {!isAuthed && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 shadow-md">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                    <p className="font-medium mb-1">Чтобы забронировать время, войдите по номеру телефона</p>
                                    <p className="text-gray-600 dark:text-gray-400">Это займет всего несколько секунд</p>
                                </div>
                            </div>
                            <button 
                                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
                                onClick={redirectToAuth}
                            >
                                Войти по SMS
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Форма выбора */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-6">
                            {/* Филиал */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    <span className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        Филиал
                                    </span>
                                </label>
                                <select
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                    value={branchId}
                                    onChange={(e) => setBranchId(e.target.value)}
                                >
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                    {branches.length === 0 && <option value="">Нет активных филиалов</option>}
                                </select>
                            </div>

                            {/* Услуга */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    <span className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        Услуга
                                    </span>
                                </label>
                                <select
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                    value={serviceId}
                                    onChange={(e) => setServiceId(e.target.value)}
                                >
                                    {servicesByBranch.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name_ru} — {s.duration_min} мин
                                            {s.price_from ? ` (${s.price_from}-${s.price_to ?? s.price_from} сом)` : ''}
                                        </option>
                                    ))}
                                    {servicesByBranch.length === 0 && <option value="">Нет услуг в этом филиале</option>}
                                </select>
                            </div>

                            {/* Мастер */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    <span className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Мастер
                                    </span>
                                </label>
                                <select
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                    value={staffId}
                                    onChange={(e) => setStaffId(e.target.value)}
                                >
                                    {staffFiltered.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.full_name}
                                        </option>
                                    ))}
                                    {staffFiltered.length === 0 && <option value="">Нет мастеров для этой услуги</option>}
                                </select>
                            </div>

                            {/* День */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    <span className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Выберите дату
                                    </span>
                                </label>
                                <div className="flex flex-wrap items-center gap-3">
                                    <input
                                        type="date"
                                        className="flex-1 min-w-[200px] px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                        value={dayStr}
                                        min={todayStr}
                                        max={maxStr}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (!v) return;
                                            setDay(dateAtTz(v, '00:00'));
                                        }}
                                    />
                                    <button 
                                        className="px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                                        onClick={() => setDay(todayTz())}
                                    >
                                        Сегодня
                                    </button>
                                    <button 
                                        className="px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                                        onClick={() => setDay(addDays(todayTz(), 1))}
                                    >
                                        Завтра
                                    </button>
                                </div>
                            </div>

                            {/* Слоты */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                    <span className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Свободные слоты
                                    </span>
                                </label>
                                {slots.length === 0 && (
                                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p>Нет свободных окон на выбранную дату</p>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                    {slots.map((t) => (
                                        <button
                                            key={t.toISOString()}
                                            disabled={loading || !!holding}
                                            className="px-4 py-2.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
                                            onClick={() => (isAuthed ? hold(t) : redirectToAuth())}
                                            title={isAuthed ? '' : 'Войдите, чтобы забронировать'}
                                        >
                                            {toLabel(t)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Корзина */}
                        <div className="bg-gradient-to-br from-indigo-50 to-pink-50 dark:from-indigo-950/30 dark:to-pink-950/30 rounded-2xl p-6 shadow-lg border border-indigo-200 dark:border-indigo-800 sticky top-24">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Корзина
                            </h2>
                            {!holding && (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p className="text-sm">Выберите слот, чтобы забронировать</p>
                                </div>
                            )}
                            {holding && (
                                <div className="space-y-4 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Слот удержан</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{leftSec}</span>
                                                <span className="text-sm text-gray-500">сек</span>
                                            </div>
                                        </div>
                                        {service && (
                                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                <p><span className="font-medium">Услуга:</span> {service.name_ru}</p>
                                                <p><span className="font-medium">Время:</span> {toLabel(new Date(holding.until - 120000))}</p>
                                            </div>
                                        )}
                                    </div>
                                    {isAuthed ? (
                                        <button 
                                            className="w-full px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                                            onClick={confirm}
                                            disabled={loading}
                                        >
                                            {loading ? 'Подтверждение...' : 'Подтвердить бронь'}
                                        </button>
                                    ) : (
                                        <button 
                                            className="w-full px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-pink-600 text-white font-bold rounded-lg hover:from-indigo-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200"
                                            onClick={redirectToAuth}
                                        >
                                            Войти, чтобы подтвердить
                                        </button>
                                    )}
                                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                        Без оплаты (MVP). После оплаты будет авто-подтверждение.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
