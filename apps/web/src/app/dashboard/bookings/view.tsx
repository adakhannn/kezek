'use client';
import {useState} from 'react';
import {supabase} from '@/lib/supabaseClient';
import {TZ} from '@/lib/time';
import {formatInTimeZone} from 'date-fns-tz';

type Item = {
    id: string; status: string; start_at: string; end_at: string;
    services?: { name_ru: string }[]; staff?: { full_name: string }[];
};

export default function BookingsClient({
                                           bizId, services, staff, branches, initial
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
    const [date, setDate] = useState<string>(() => formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd'));
    const [time, setTime] = useState('12:00');

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
        await refresh();
    }

    async function cancel(id: string) {
        const {error} = await supabase.rpc('cancel_booking', {p_booking_id: id});
        if (error) return alert(error.message);
        await refresh();
    }

    async function quickCreate() {
        const svc = services.find(s => s.id === serviceId);
        if (!svc) return alert('Выбери услугу');
        const startISO = `${date}T${time}:00+06:00`;
        const {data, error} = await supabase.rpc('create_internal_booking', {
            p_biz_id: bizId,
            p_branch_id: branchId,
            p_service_id: serviceId,
            p_staff_id: staffId,
            p_start: startISO,
            p_minutes: svc.duration_min,
            p_client_id: null, // можно потом выбрать клиента из списка
        });
        if (error) return alert(error.message);
        await refresh();
        alert(`Создана запись #${String(data).slice(0, 8)}`);
    }

    return (
        <main className="mx-auto max-w-6xl p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Брони</h1>

            <section className="border rounded p-4">
                <h2 className="font-medium mb-3">Быстрая запись (стойка)</h2>
                <div className="grid sm:grid-cols-5 gap-2">
                    <select className="border rounded px-2 py-1" value={branchId}
                            onChange={e => setBranchId(e.target.value)}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <select className="border rounded px-2 py-1" value={serviceId}
                            onChange={e => setServiceId(e.target.value)}>
                        {services.map(s => <option key={s.id} value={s.id}>{s.name_ru} ({s.duration_min}м)</option>)}
                    </select>
                    <select className="border rounded px-2 py-1" value={staffId}
                            onChange={e => setStaffId(e.target.value)}>
                        {staff.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                    <input className="border rounded px-2 py-1" type="date" value={date}
                           onChange={e => setDate(e.target.value)}/>
                    <input className="border rounded px-2 py-1" type="time" value={time}
                           onChange={e => setTime(e.target.value)} step={900}/>
                </div>
                <div className="mt-3">
                    <button className="border px-3 py-1 rounded" onClick={quickCreate}>Создать запись</button>
                </div>
            </section>

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
                        {list.map(b => {
                            const service = Array.isArray(b.services) ? b.services[0] : b.services;
                            const master = Array.isArray(b.staff) ? b.staff[0] : b.staff;
                            return (
                                <tr key={b.id} className="border-t">
                                    <td className="p-2">{String(b.id).slice(0, 8)}</td>
                                    <td className="p-2">{service?.name_ru}</td>
                                    <td className="p-2">{master?.full_name}</td>
                                    <td className="p-2">{formatInTimeZone(new Date(b.start_at), TZ, 'dd.MM.yyyy HH:mm')}</td>
                                    <td className="p-2">{b.status}</td>
                                    <td className="p-2 flex gap-2">
                                        {b.status !== 'cancelled' && <button className="border px-2 py-1 rounded"
                                                                             onClick={() => cancel(b.id)}>Отменить</button>}
                                        {b.status === 'hold' && <button className="border px-2 py-1 rounded"
                                                                        onClick={() => confirm(b.id)}>Подтвердить</button>}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3">
                    <button className="border px-3 py-1 rounded" onClick={refresh}>Обновить</button>
                </div>
            </section>
        </main>
    );
}
