'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { TZ, todayTz, dateAtTz, toLabel, enumerateSlots } from '@/lib/time';
import { addDays, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

type Data = {
    biz: { id: string; name: string; address: string; phones: string[] };
    branch: { id: string; name: string } | null;
    services: { id: string; name_ru: string; duration_min: number; price_from: number; price_to: number }[];
    staff: { id: string; full_name: string }[];
};

export default function BizClient({ data }: { data: Data }) {
    const { biz, branch, services, staff } = data;
    const [serviceId, setServiceId] = useState<string>(services[0]?.id || '');
    const [staffId, setStaffId] = useState<string>(staff[0]?.id || '');
    const [day, setDay] = useState<Date>(todayTz()); // 00:00 текущего дня (UTC, но представляем как Bishkek)

    const dayStr = formatInTimeZone(day, TZ, 'yyyy-MM-dd');
    const tomorrow = addDays(day, 1);

    const [intervals, setIntervals] = useState<{start: string; end: string}[]>([]);
    const [booked, setBooked] = useState<{start_at: string; end_at: string; staff_id: string}[]>([]);
    const [busy, setBusy] = useState<Set<number>>(new Set()); // минуты от полуночи занятые

    // тянем рабочие окна мастера на день недели
    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!staffId) return;
            // day_of_week: 0..6 (в БД), JS: 0-вс → согласуем формат
            const dow = Number(format(day, 'i')) % 7; // ISO 1..7 → 0..6
            const { data: wh, error } = await supabase
                .from('working_hours')
                .select('intervals,breaks')
                .eq('biz_id', biz.id)
                .eq('staff_id', staffId)
                .eq('day_of_week', dow);
            if (error) { console.error(error); return; }
            if (ignore) return;
            const merged = (wh?.[0]?.intervals || []) as {start:string,end:string}[];
            setIntervals(merged);
        })();
        return () => { ignore = true; };
    }, [biz.id, staffId, day]);

    // тянем занятые брони на выбранный день
    useEffect(() => {
        let ignore = false;
        (async () => {
            const startDay = formatInTimeZone(day, TZ, "yyyy-MM-dd'T'00:00:00XXX");
            const endDay   = formatInTimeZone(addDays(day,1), TZ, "yyyy-MM-dd'T'00:00:00XXX");
            const { data, error } = await supabase
                .from('bookings')
                .select('start_at,end_at,staff_id,status')
                .eq('biz_id', biz.id)
                .eq('staff_id', staffId)
                .in('status', ['hold','confirmed','paid'])
                .gte('start_at', startDay)
                .lt('start_at', endDay);
            if (error) { console.error(error); return; }
            if (ignore) return;
            setBooked((data||[]) as any);
            // посчитаем дуги занятости в минутах от полуночи TZ
            const set = new Set<number>();
            for (const b of (data||[])) {
                const s = new Date(b.start_at);
                const e = new Date(b.end_at);
                // локаль в TZ для минут-от-полуночи
                const base = new Date(formatInTimeZone(day, TZ, "yyyy-MM-dd'T'00:00:00XXX"));
                const m0 = Math.floor((s.getTime() - base.getTime())/60000);
                const m1 = Math.floor((e.getTime() - base.getTime())/60000);
                for (let m = m0; m < m1; m++) set.add(m);
            }
            setBusy(set);
        })();
        return () => { ignore = true; };
    }, [biz.id, staffId, day]);

    const service = services.find(s => s.id === serviceId);
    const slots: Date[] = useMemo(() => {
        if (!service || intervals.length === 0) return [];
        const res: Date[] = [];
        for (const win of intervals) {
            const winStart = dateAtTz(dayStr, win.start);
            const winEnd   = dateAtTz(dayStr, win.end);
            const enumed = enumerateSlots(winStart, winEnd, service.duration_min, 15);
            // отфильтруем по занятости
            for (const t of enumed) {
                const base = new Date(formatInTimeZone(day, TZ, "yyyy-MM-dd'T'00:00:00XXX"));
                const startM = Math.floor((t.getTime() - base.getTime())/60000);
                const endM = startM + service.duration_min;
                let ok = true;
                for (let m = startM; m < endM; m++) if (busy.has(m)) { ok = false; break; }
                if (ok) res.push(t);
            }
        }
        return res;
    }, [intervals, service, busy, day, dayStr]);

    const [holding, setHolding] = useState<{bookingId: string; until: number} | null>(null);
    const [loading, setLoading] = useState(false);

    async function hold(t: Date) {
        if (!branch) return alert('Нет филиала');
        if (!service) return alert('Выбери услугу');
        setLoading(true);
        try {
            // приводим к ISO с TZ
            const startISO = formatInTimeZone(t, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
            const { data, error } = await supabase.rpc('hold_slot', {
                p_biz_id: biz.id,
                p_branch_id: branch.id,
                p_service_id: service.id,
                p_staff_id: staffId,
                p_start: startISO
            });
            if (error) throw error;
            const bookingId = data as string;
            setHolding({ bookingId, until: Date.now() + 120_000 });
        } catch (e:any) {
            alert(e.message || e);
        } finally {
            setLoading(false);
        }
    }

    async function confirm() {
        if (!holding) return;
        const { error } = await supabase.rpc('confirm_booking', { p_booking_id: holding.bookingId });
        if (error) return alert(error.message);
        location.href = `/booking/${holding.bookingId}`;
    }

    // простой таймер обратного отсчёта
    const [tick, setTick] = useState(0);
    useEffect(() => { const id = setInterval(()=>setTick(t=>t+1), 500); return ()=>clearInterval(id); },[]);
    const leftSec = Math.max(0, holding ? Math.ceil((holding.until - Date.now())/1000) : 0);

    return (
        <main className="mx-auto max-w-4xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">{biz.name}</h1>
                    <p className="text-gray-600">{biz.address}</p>
                </div>
                <AuthPanel />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 border p-3 rounded">
                    <h2 className="font-medium mb-2">Услуга</h2>
                    <select className="border rounded px-2 py-1 w-full mb-3" value={serviceId} onChange={e=>setServiceId(e.target.value)}>
                        {services.map(s=>(
                            <option key={s.id} value={s.id}>{s.name_ru} — {s.duration_min} мин ({s.price_from}-{s.price_to} сом)</option>
                        ))}
                    </select>

                    <h2 className="font-medium mb-2">Мастер</h2>
                    <select className="border rounded px-2 py-1 w-full mb-3" value={staffId} onChange={e=>setStaffId(e.target.value)}>
                        {staff.map(m=>(<option key={m.id} value={m.id}>{m.full_name}</option>))}
                    </select>

                    <h2 className="font-medium mb-2">День</h2>
                    <div className="flex gap-2 mb-3">
                        <button className="border px-3 py-1 rounded" onClick={()=>setDay(todayTz())}>Сегодня</button>
                        <button className="border px-3 py-1 rounded" onClick={()=>setDay(addDays(todayTz(),1))}>Завтра</button>
                    </div>

                    <h2 className="font-medium mb-2">Свободные слоты</h2>
                    {slots.length === 0 && <div className="text-gray-500">Нет свободных окон</div>}
                    <div className="flex flex-wrap gap-2">
                        {slots.map((t)=>(
                            <button
                                key={t.toISOString()}
                                disabled={loading || !!holding}
                                className="border px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
                                onClick={()=>hold(t)}
                            >
                                {toLabel(t)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border p-3 rounded">
                    <h2 className="font-medium mb-2">Корзина</h2>
                    {!holding && <div className="text-gray-500 text-sm">Выберите слот, чтобы забронировать.</div>}
                    {holding && (
                        <div className="space-y-2">
                            <div className="text-sm">Слот удержан на <b>{leftSec}</b> сек.</div>
                            <button className="border px-3 py-1 rounded w-full" onClick={confirm}>Подтвердить бронь</button>
                            <div className="text-xs text-gray-500">Без оплаты (MVP). После оплаты будет авто-подтверждение.</div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

function AuthPanel() {
    // ленивый импорт из компонента (чтоб не тащить на сервер)
    const [C, setC] = useState<any>(null);
    useEffect(()=>{ import('@/components/auth/AuthPanel').then(m=>setC(()=>m.default)); },[]);
    if (!C) return <div/>;
    return <C/>;
}
