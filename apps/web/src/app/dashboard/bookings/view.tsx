'use client';

import {formatInTimeZone} from 'date-fns-tz';
import Link from "next/link";
import {useEffect, useMemo, useState} from 'react';

import {supabase} from '@/lib/supabaseClient';
import {TZ} from '@/lib/time';


// ---------- Общие типы ----------
type ServiceRow = { id: string; name_ru: string; duration_min: number };
type StaffRow = { id: string; full_name: string };
type BranchRow = { id: string; name: string };

type BookingItem = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    start_at: string;
    end_at: string;
    services?: { name_ru: string }[];
    staff?: { full_name: string }[];
};

// Для запроса свободных слотов (если захочешь расширить стойку)
type RpcSlot = {
    staff_id: string;
    start_at: string; // ISO
    end_at: string;   // ISO
};

// ---------- Уведомления ----------
async function notify(type: 'hold' | 'confirm' | 'cancel', bookingId: string) {
    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            body: JSON.stringify({type, booking_id: bookingId}),
        });
    } catch (e) {
        console.error('notify failed', type, bookingId, e);
    }
}

// ---------- Tabs ----------
type TabKey = 'calendar' | 'list' | 'desk';

function Tabs({value, onChange}: { value: TabKey; onChange: (v: TabKey) => void }) {
    const btn = (key: TabKey, label: string) => (
        <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-3 py-1 border rounded ${
                value === key ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
            }`}
        >
            {label}
        </button>
    );
    return (
        <div className="flex gap-2">
            {btn('calendar', 'Календарь')}
            {btn('list', 'Список')}
            {btn('desk', 'Стойка')}
        </div>
    );
}

// ---------- Календарь: День × Мастера ----------
function hourRange(start: number, end: number): number[] {
    const res: number[] = [];
    for (let h = start; h <= end; h++) res.push(h);
    return res;
}

// нормализуем к минутам от полуночи
function minutesFromMidnight(d: Date) {
    return d.getHours() * 60 + d.getMinutes();
}

function cellKey(staffId: string, hour: number) {
    return `${staffId}-${hour}`;
}

function statusClasses(status: 'hold' | 'confirmed' | 'paid' | 'cancelled') {
    switch (status) {
        case 'hold':
            return 'bg-yellow-50 border-yellow-300 text-yellow-800';
        case 'confirmed':
            return 'bg-blue-50 border-blue-300 text-blue-800';
        case 'paid':
            return 'bg-green-50 border-green-300 text-green-800';
        case 'cancelled':
            return 'bg-gray-50 border-gray-300 text-gray-600 line-through';
        default:
            return 'bg-gray-50 border-gray-300 text-gray-700';
    }
}

function BookingPill({
                         id,
                         startISO,
                         endISO,
                         status,
                     }: {
    id: string;
    startISO: string;
    endISO: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
}) {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const label = `${formatInTimeZone(start, TZ, 'HH:mm')}–${formatInTimeZone(end, TZ, 'HH:mm')}`;

    return (
        <Link
            href={`/booking/${id}`}
            className={`inline-block text-[11px] px-1.5 py-0.5 border rounded ${statusClasses(status)} hover:opacity-90`}
            title={`Открыть бронь #${id.slice(0, 8)}`}
        >
            {label}
        </Link>
    );
}

function CalendarDay({
                         bizId,
                         staff,
                     }: {
    bizId: string;
    staff: StaffRow[];
}) {
    const [date, setDate] = useState<string>(() =>
        formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'),
    );
    const [items, setItems] = useState<
        { id: string; staff_id: string; start_at: string; end_at: string; status: BookingItem['status'] }[]
    >([]);

    function exportCsv() {
        const rows = items.map((r) => ({
            id: r.id,
            staff_id: r.staff_id,
            start_at: formatInTimeZone(new Date(r.start_at), TZ, 'yyyy-MM-dd HH:mm'),
            end_at:   formatInTimeZone(new Date(r.end_at), TZ, 'yyyy-MM-dd HH:mm'),
            status:   r.status,
        }));
        const header = 'id,staff_id,start_at,end_at,status';
        const body = rows.map(r => `${r.id},${r.staff_id},${r.start_at},${r.end_at},${r.status}`).join('\n');
        const csv = `${header}\n${body}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookings-${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }


    useEffect(() => {
        let ignore = false;
        (async () => {
            const startDay = `${date}T00:00:00+06:00`;
            const endDay = `${date}T23:59:59+06:00`;

            const {data, error} = await supabase
                .from('bookings')
                .select('id,staff_id,start_at,end_at,status')
                .eq('biz_id', bizId)
                .neq('status', 'cancelled')
                .gte('start_at', startDay)
                .lte('start_at', endDay)
                .order('start_at', {ascending: true});

            if (ignore) return;
            if (error) {
                console.error(error);
                setItems([]);
                return;
            }
            const rows = (data ?? []).map(r => ({
                id: String(r.id),
                staff_id: String(r.staff_id),
                start_at: String(r.start_at),
                end_at: String(r.end_at),
                status: r.status as BookingItem['status'],
            }));
            setItems(rows);
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, date]);

    const hours = hourRange(9, 21); // базовый коридор; позже можно подхватить из working_hours
    const byStaff = useMemo(() => {
        const map = new Map<string, {
            id: string;
            staff_id: string;
            start_at: string;
            end_at: string;
            status: BookingItem['status']
        }[]>();
        for (const s of staff) map.set(s.id, []);
        for (const it of items) {
            if (!map.has(it.staff_id)) map.set(it.staff_id, []);
            map.get(it.staff_id)!.push(it);
        }
        return map;
    }, [items, staff]);

    return (
        <section className="border rounded p-4">
            <div className="flex items-center justify-between mb-3">
                <h2 className="font-medium">Календарь на день</h2>
                <div className="flex items-center gap-2">
                    <input
                        className="border rounded px-2 py-1"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                    <button className="border px-2 py-1 rounded" onClick={exportCsv}>Экспорт CSV</button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                    <tr className="text-left">
                        <th className="p-2 w-24 text-gray-500">Время</th>
                        {staff.map(s => (
                            <th key={s.id} className="p-2">{s.full_name}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {hours.map((h) => (
                        <tr key={h} className="border-t align-top">
                            <td className="p-2 text-gray-500">{`${String(h).padStart(2, '0')}:00`}</td>
                            {staff.map((s) => {
                                const events = (byStaff.get(s.id) ?? []).filter(ev => {
                                    const mins = minutesFromMidnight(new Date(ev.start_at));
                                    return Math.floor(mins / 60) === h; // попадает в этот час
                                });
                                return (
                                    <td key={cellKey(s.id, h)} className="p-2">
                                        {events.length === 0 && <span className="text-gray-300 text-xs">—</span>}
                                        {events.map(ev => (
                                            <div key={ev.id} className="mb-1">
                                                <BookingPill id={ev.id} startISO={ev.start_at} endISO={ev.end_at}
                                                             status={ev.status}/>
                                            </div>
                                        ))}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-3 text-xs text-gray-600 mt-3">
                <span><span
                    className="inline-block w-3 h-3 align-[-1px] mr-1 rounded border border-yellow-300 bg-yellow-50"/> hold</span>
                <span><span
                    className="inline-block w-3 h-3 align-[-1px] mr-1 rounded border border-blue-300 bg-blue-50"/> confirmed</span>
                <span><span
                    className="inline-block w-3 h-3 align-[-1px] mr-1 rounded border border-green-300 bg-green-50"/> paid</span>
                <span><span
                    className="inline-block w-3 h-3 align-[-1px] mr-1 rounded border border-gray-300 bg-gray-50"/> cancelled</span>
            </div>
        </section>
    );
}

// ---------- Таблица: Список ----------
function ListTable({
                       bizId,
                       initial,
                   }: {
    bizId: string;
    initial: BookingItem[];
}) {
    const [list, setList] = useState<BookingItem[]>(initial);

    async function refresh() {
        const {data} = await supabase
            .from('bookings')
            .select('id,status,start_at,end_at,services(name_ru),staff(full_name)')
            .eq('biz_id', bizId)
            .order('start_at', {ascending: false})
            .limit(30);
        setList(data || []);
    }

    async function confirm(id: string) {
        const {error} = await supabase.rpc('confirm_booking', {p_booking_id: id});
        if (error) return alert(error.message);
        await notify('confirm', id);
        await refresh();
    }

    async function cancel(id: string) {
        const {error} = await supabase.rpc('cancel_booking', {p_booking_id: id});
        if (error) return alert(error.message);
        await notify('cancel', id);
        await refresh();
    }

    return (
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
    );
}

// ---------- Стойка (быстрая запись) ----------
function QuickDesk({
                       bizId,
                       services,
                       staff,
                       branches,
                   }: {
    bizId: string;
    services: { id: string; name_ru: string; duration_min: number }[];
    staff: { id: string; full_name: string }[];
    branches: { id: string; name: string }[];
}) {
    const [serviceId, setServiceId] = useState(services[0]?.id || '');
    const [staffId, setStaffId] = useState(staff[0]?.id || '');
    const [branchId, setBranchId] = useState(branches[0]?.id || '');
    const [date, setDate] = useState<string>(() =>
        formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'),
    );

    // НОВОЕ: реальные свободные слоты для выбранных (услуга, мастер, день)
    const [slots, setSlots] = useState<RpcSlot[]>([]);
    const [slotStartISO, setSlotStartISO] = useState<string>('');

    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!serviceId || !date) {
                setSlots([]);
                setSlotStartISO('');
                return;
            }
            const {data, error} = await supabase.rpc('get_free_slots_service_day', {
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
            const raw = (data || []) as RpcSlot[];

            // фильтруем по выбранному мастеру
            const filtered = staffId ? raw.filter(s => s.staff_id === staffId) : raw;

            setSlots(filtered);
            setSlotStartISO(filtered[0]?.start_at || '');
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, serviceId, staffId, date]);

    async function quickCreate() {
        const svc = services.find((s) => s.id === serviceId);
        if (!svc) return alert('Выбери услугу');
        if (!slotStartISO) return alert('Нет свободных слотов на выбранные параметры');

        const {data, error} = await supabase.rpc('create_internal_booking', {
            p_biz_id: bizId,
            p_branch_id: branchId,
            p_service_id: serviceId,
            p_staff_id: staffId,
            p_start: slotStartISO,       // выбранный реальный слот
            p_minutes: svc.duration_min,
            p_client_id: null,           // позже — выбор клиента
        });
        if (error) return alert(error.message);

        const bookingId = String(data);
        await notify('confirm', bookingId);
        alert(`Создана запись #${bookingId.slice(0, 8)}`);
    }

    return (
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
                        <option key={b.id} value={b.id}>{b.name}</option>
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
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                </select>

                {/* день */}
                <input
                    className="border rounded px-2 py-1"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                />

                {/* НОВОЕ: слот из реальных свободных окон (вместо ручного времени) */}
                <select
                    className="border rounded px-2 py-1"
                    value={slotStartISO}
                    onChange={(e) => setSlotStartISO(e.target.value)}
                >
                    {slots.length === 0 && <option value="">Нет свободных слотов</option>}
                    {slots.map((s) => (
                        <option key={s.start_at} value={s.start_at}>
                            {formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}
                        </option>
                    ))}
                </select>
            </div>

            <div className="mt-3">
                <button className="border px-3 py-1 rounded" onClick={quickCreate}>
                    Создать запись
                </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
                Слоты рассчитываются по `get_free_slots_service_day` с учётом занятых броней и длительности услуги.
            </p>
        </section>
    );
}

// ---------- Главный компонент страницы ----------
export default function AdminBookingsView({
                                              bizId,
                                              services,
                                              staff,
                                              branches,
                                              initial,
                                          }: {
    bizId: string;
    services: ServiceRow[];
    staff: StaffRow[];
    branches: BranchRow[];
    initial: BookingItem[];
}) {
    const [tab, setTab] = useState<TabKey>('calendar');

    return (
        <main className="mx-auto max-w-6xl p-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Брони</h1>
                <Tabs value={tab} onChange={setTab}/>
            </div>

            {tab === 'calendar' && <CalendarDay bizId={bizId} staff={staff}/>}
            {tab === 'list' && <ListTable bizId={bizId} initial={initial}/>}
            {tab === 'desk' && <QuickDesk bizId={bizId} services={services} staff={staff} branches={branches}/>}
        </main>
    );
}
