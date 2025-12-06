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
        <main className="mx-auto max-w-4xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">{biz.name}</h1>
                    <p className="text-gray-600">{biz.address}</p>
                </div>
                <AuthPanelLazy />
            </div>

            {!isAuthed && (
                <div className="border rounded p-3 bg-yellow-50 text-sm flex items-center justify-between">
                    <div>Чтобы забронировать время, войдите по номеру телефона.</div>
                    <button className="border px-3 py-1 rounded" onClick={redirectToAuth}>
                        Войти по SMS
                    </button>
                </div>
            )}

            <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 border p-3 rounded">
                    {/* Филиал */}
                    <h2 className="font-medium mb-2">Филиал</h2>
                    <select
                        className="border rounded px-2 py-1 w-full mb-3"
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

                    {/* Услуга */}
                    <h2 className="font-medium mb-2">Услуга</h2>
                    <select
                        className="border rounded px-2 py-1 w-full mb-3"
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

                    {/* Мастер — фильтруется по филиалу и по навыку (если данные есть) */}
                    <h2 className="font-medium mb-2">Мастер</h2>
                    <select
                        className="border rounded px-2 py-1 w-full mb-3"
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

                    {/* День */}
                    <h2 className="font-medium mb-2">День</h2>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <input
                            type="date"
                            className="border rounded px-2 py-1"
                            value={dayStr}
                            min={todayStr}
                            max={maxStr}
                            onChange={(e) => {
                                const v = e.target.value; // 'yyyy-MM-dd'
                                if (!v) return;
                                setDay(dateAtTz(v, '00:00'));
                            }}
                        />
                        <button className="border px-3 py-1 rounded" onClick={() => setDay(todayTz())}>
                            Сегодня
                        </button>
                        <button className="border px-3 py-1 rounded" onClick={() => setDay(addDays(todayTz(), 1))}>
                            Завтра
                        </button>
                    </div>

                    {/* Слоты */}
                    <h2 className="font-medium mb-2">Свободные слоты</h2>
                    {slots.length === 0 && <div className="text-gray-500">Нет свободных окон</div>}
                    <div className="flex flex-wrap gap-2">
                        {slots.map((t) => (
                            <button
                                key={t.toISOString()}
                                disabled={loading || !!holding}
                                className="border px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
                                onClick={() => (isAuthed ? hold(t) : redirectToAuth())}
                                title={isAuthed ? '' : 'Войдите, чтобы забронировать'}
                            >
                                {toLabel(t)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Корзина */}
                <div className="border p-3 rounded">
                    <h2 className="font-medium mb-2">Корзина</h2>
                    {!holding && <div className="text-gray-500 text-sm">Выберите слот, чтобы забронировать.</div>}
                    {holding && (
                        <div className="space-y-2">
                            <div className="text-sm">
                                Слот удержан на <b>{leftSec}</b> сек.
                            </div>
                            {isAuthed ? (
                                <button className="border px-3 py-1 rounded w-full" onClick={confirm}>
                                    Подтвердить бронь
                                </button>
                            ) : (
                                <button className="border px-3 py-1 rounded w-full" onClick={redirectToAuth}>
                                    Войти, чтобы подтвердить
                                </button>
                            )}
                            <div className="text-xs text-gray-500">
                                Без оплаты (MVP). После оплаты будет авто-подтверждение.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
