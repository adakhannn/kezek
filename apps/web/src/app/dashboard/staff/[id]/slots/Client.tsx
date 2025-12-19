'use client';

import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

type Service = { id: string; name: string; duration_min: number; branch_id: string };
type Branch  = { id: string; name: string };

// RPC ответ (см. get_free_slots_service_day_v2)
type Slot = {
    staff_id: string;
    branch_id: string;
    start_at: string; // ISO
    end_at: string;   // ISO
};

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
    defaultDate: string; // yyyy-MM-dd
}) {
    // фильтр по филиалу → список услуг этого филиала
    const [branchId, setBranchId] = useState<string>(branches[0]?.id || '');
    const servicesByBranch = useMemo(
        () => services.filter(s => s.branch_id === branchId),
        [services, branchId]
    );

    // выбранные сервис/дата
    const [serviceId, setServiceId] = useState<string>(servicesByBranch[0]?.id || '');
    const [date, setDate] = useState<string>(defaultDate);

    // слоты именно этого сотрудника
    const [slots, setSlots] = useState<Slot[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const uniq = Array.from(new Map(slots.map(s => [s.start_at, s])).values());


    // когда переключаем филиал — подстроим выбранную услугу
    useEffect(() => {
        setServiceId(prev => servicesByBranch.some(s => s.id === prev) ? prev : (servicesByBranch[0]?.id || ''));
    }, [servicesByBranch]);

    // загрузка слотов от RPC v2 (на уровне сервиса и даты), затем фильтрация по staffId
    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!serviceId || !date) { setSlots([]); return; }
            setLoading(true); setErr(null);
            try {
                const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
                    p_biz_id: bizId,
                    p_service_id: serviceId,
                    p_day: date,       // 'yyyy-MM-dd'
                    p_per_staff: 400,  // побольше, но всё равно обрежет по мастеру
                    p_step_min: 15,
                });
                if (ignore) return;
                if (error) { setSlots([]); setErr(error.message); return; }
                const all = (data ?? []) as Slot[];
                const now = new Date();
                const minTime = addMinutes(now, 30); // минимум через 30 минут от текущего времени
                // конкретный сотрудник + на нужный филиал (совпадает с филиалом услуги) + только будущие слоты (минимум через 30 минут)
                const filtered = all.filter(s => 
                    s.staff_id === staffId && 
                    s.branch_id === branchId &&
                    new Date(s.start_at) > minTime
                );
                setSlots(filtered);
            } finally { if (!ignore) setLoading(false); }
        })();
        return () => { ignore = true; };
    }, [bizId, serviceId, date, staffId, branchId]);

    async function createBooking(startISO: string) {
        const svc = services.find(s => s.id === serviceId);
        if (!svc) return alert('Не найдена услуга');
        const { data, error } = await supabase.rpc('create_internal_booking', {
            p_biz_id: bizId,
            p_branch_id: branchId,
            p_service_id: serviceId,
            p_staff_id: staffId,
            p_start: startISO,
            p_minutes: svc.duration_min,
            p_client_id: null,
        });
        if (error) return alert(error.message);
        const id = String(data);
        alert(`Создана запись #${id.slice(0,8)}`);
    }



    return (
        <section className="border rounded p-4 space-y-3">
            <div className="grid sm:grid-cols-4 gap-2">
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Филиал</label>
                    <select className="border rounded px-2 py-1 w-full"
                            value={branchId} onChange={e=>setBranchId(e.target.value)}>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Услуга</label>
                    <select className="border rounded px-2 py-1 w-full"
                            value={serviceId} onChange={e=>setServiceId(e.target.value)}>
                        {servicesByBranch.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name} ({s.duration_min}м)
                            </option>
                        ))}
                        {servicesByBranch.length===0 && <option value="">Нет услуг в филиале</option>}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-600 mb-1">Дата</label>
                    <input className="border rounded px-2 py-1 w-full" type="date" value={date}
                           onChange={e=>setDate(e.target.value)} />
                </div>
            </div>

            <div className="border-t pt-3">
                <h3 className="font-medium mb-2">Свободные слоты</h3>
                {loading && <div className="text-sm text-gray-500">Загружаем…</div>}
                {err && <div className="text-sm text-red-600">Ошибка: {err}</div>}

                {(!loading && uniq.length === 0) && (
                    <div className="text-sm text-gray-500">Нет свободных слотов на выбранные параметры</div>
                )}

                <div className="flex flex-wrap gap-2">
                    {uniq.map(s => {
                        const label = `${formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}–${formatInTimeZone(new Date(s.end_at), TZ, 'HH:mm')}`;
                        return (
                            <button
                                key={s.start_at}
                                className="border rounded px-2 py-1 text-sm hover:bg-gray-50"
                                onClick={()=>createBooking(s.start_at)}
                                title="Создать запись в этот слот"
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <p className="text-xs text-gray-500">
                Слоты рассчитываются RPC <code>get_free_slots_service_day_v2</code> с учётом правил расписания,
                родного филиала и существующих броней.
            </p>
        </section>
    );
}
