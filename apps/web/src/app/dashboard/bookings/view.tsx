'use client';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

// helper для уведомлений
async function notify(type: 'hold' | 'confirm' | 'cancel', bookingId: string) {
    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, booking_id: bookingId }),
        });
    } catch (e) {
        console.error('notify failed', type, bookingId, e);
    }
}

type Item = {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    services?: { name_ru: string }[];
    staff?: { full_name: string }[];
};

// слот из RPC
type RpcSlot = {
    staff_id: string;
    start_at: string; // ISO
    end_at: string;   // ISO
};

export default function BookingsClient({
                                           bizId,
                                           services,
                                           staff,
                                           branches,
                                           initial,
                                       }: {
    bizId: string;
    services: { id: string; name_ru: string; duration_min: number }[];
    staff: { id: string; full_name: string }[];
    branches: { id: string; name: string }[];
    initial: Item[];
}) {
    const [list, setList] = useState<Item[]>(initial);
    const [serviceId, setServiceId] = useState(services[0]?.id || '');
    const [staffId, setStaffId] = useState(staff[0]?.id || '');
    const [branchId, setBranchId] = useState(branches[0]?.id || '');

    // выбор дня (YYYY-MM-DD)
    const [date, setDate] = useState<string>(() =>
        formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'),
    );

    // ----- НОВОЕ: загрузка свободных слотов -----
    const [slots, setSlots] = useState<RpcSlot[]>([]);
    const [slotStartISO, setSlotStartISO] = useState<string>(''); // выбранный слот

    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!serviceId || !date) {
                setSlots([]);
                setSlotStartISO('');
                return;
            }
            // тянем свободные слоты по услуге на день
            const { data, error } = await supabase.rpc('get_free_slots_service_day', {
                p_biz_id: bizId,
                p_service_id: serviceId,
                p_day: date,         // 'yyyy-MM-dd'
                p_per_staff: 200,    // с запасом
                p_step_min: 15,
                p_tz: TZ,
            });
            if (ignore) return;
            if (error) {
                console.error(error);
                setSlots([]);
                setSlotStartISO('');
                return;
            }

            const raw: RpcSlot[] = (data || []) as RpcSlot[];

            // если выбран мастер — фильтруем по нему
            const filtered = staffId ? raw.filter(s => s.staff_id === staffId) : raw;

            setSlots(filtered);

            // авто-выбор первого слота
            setSlotStartISO(filtered[0]?.start_at || '');
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, serviceId, staffId, date]);

    // для рендера имени мастера
    const staffNameById = useMemo(() => {
        const m = new Map<string, string>();
        for (const s of staff) m.set(s.id, s.full_name);
        return m;
    }, [staff]);

    async function refresh() {
        const { data } = await supabase
            .from('bookings')
            .select('id,status,start_at,end_at,services(name_ru),staff(full_name)')
            .eq('biz_id', bizId)
            .order('start_at', { ascending: false })
            .limit(30);
        setList(data || []);
    }

    async function confirm(id: string) {
        const { error } = await supabase.rpc('confirm_booking', {
            p_booking_id: id,
        });
        if (error) return alert(error.message);

        await notify('confirm', id);
        await refresh();
    }

    async function cancel(id: string) {
        const { error } = await supabase.rpc('cancel_booking', {
            p_booking_id: id,
        });
        if (error) return alert(error.message);

        await notify('cancel', id);
        await refresh();
    }

    // ----- quickCreate из выбранного слота -----
    async function quickCreate() {
        const svc = services.find((s) => s.id === serviceId);
        if (!svc) return alert('Выбери услугу');
        if (!slotStartISO) return alert('Нет свободных слотов на выбранные параметры');

        const { data, error } = await supabase.rpc('create_internal_booking', {
            p_biz_id: bizId,
            p_branch_id: branchId,
            p_service_id: serviceId,
            p_staff_id: staffId,
            p_start: slotStartISO,       // берём из select со слотами
            p_minutes: svc.duration_min,
            p_client_id: null,           // позже — выбор клиента
        });
        if (error) return alert(error.message);

        const bookingId = String(data);

        await notify('confirm', bookingId);
        await refresh();
        alert(`Создана запись #${bookingId.slice(0, 8)}`);
    }

    return (
        <main className="mx-auto max-w-6xl p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Брони</h1>

            {/* Быстрая запись из свободных слотов */}
            <section className="border rounded p-4">
                <h2 className="font-medium mb-3">Быстрая запись (стойка)</h2>
                <div className="grid sm:grid-cols-5 gap-2">
                    {/* филиал */}
                    <select
                        className="border rounded px-2 py-1"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                    >
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </select>

                    {/* услуга */}
                    <select
                        className="border rounded px-2 py-1"
                        value={serviceId}
                        onChange={(e) => setServiceId(e.target.value)}
                    >
                        {services.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name_ru} ({s.duration_min}м)
                            </option>
                        ))}
                    </select>

                    {/* мастер */}
                    <select
                        className="border rounded px-2 py-1"
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                    >
                        {staff.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.full_name}
                            </option>
                        ))}
                    </select>

                    {/* день */}
                    <input
                        className="border rounded px-2 py-1"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />

                    {/* слот времени (из RPC) */}
                    <select
                        className="border rounded px-2 py-1"
                        value={slotStartISO}
                        onChange={(e) => setSlotStartISO(e.target.value)}
                    >
                        {slots.length === 0 && <option value="">Нет свободных слотов</option>}
                        {slots.map((s) => (
                            <option key={s.start_at} value={s.start_at}>
                                {formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}
                                {staffNameById.get(s.staff_id) ? ` — ${staffNameById.get(s.staff_id)}` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="mt-3">
                    <button className="border px-3 py-1 rounded" onClick={quickCreate}>
                        Создать запись
                    </button>
                </div>
            </section>

            {/* Последние 30 броней */}
            <section className="border rounded p-4">
                <h2 className="font-medium mb-3">Последние 30 броней</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                        <tr className="text-left">
                            <th className="p-2">#</th>
                            <th className="p-2">Услуга</th>
                            <th className="p-2">Мастер</th>
                            <th className="p-2">Начало</th>
                            <th className="p-2">Статус</th>
                            <th className="p-2">Действия</th>
                        </tr>
                        </thead>
                        <tbody>
                        {list.map((b) => {
                            const service = Array.isArray(b.services) ? b.services[0] : b.services;
                            const master = Array.isArray(b.staff) ? b.staff[0] : b.staff;
                            return (
                                <tr key={b.id} className="border-t">
                                    <td className="p-2">{String(b.id).slice(0, 8)}</td>
                                    <td className="p-2">{service?.name_ru}</td>
                                    <td className="p-2">{master?.full_name}</td>
                                    <td className="p-2">
                                        {formatInTimeZone(new Date(b.start_at), TZ, 'dd.MM.yyyy HH:mm')}
                                    </td>
                                    <td className="p-2">{b.status}</td>
                                    <td className="p-2 flex gap-2">
                                        {b.status !== 'cancelled' && (
                                            <button className="border px-2 py-1 rounded" onClick={() => cancel(b.id)}>
                                                Отменить
                                            </button>
                                        )}
                                        {b.status === 'hold' && (
                                            <button className="border px-2 py-1 rounded" onClick={() => confirm(b.id)}>
                                                Подтвердить
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>

                <div className="mt-3">
                    <button className="border px-3 py-1 rounded" onClick={refresh}>
                        Обновить
                    </button>
                </div>
            </section>
        </main>
    );
}
