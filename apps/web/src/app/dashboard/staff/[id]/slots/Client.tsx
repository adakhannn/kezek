'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
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
                // конкретный сотрудник + на нужный филиал (совпадает с филиалом услуги)
                const filtered = all.filter(s => s.staff_id === staffId && s.branch_id === branchId);
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
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Свободные слоты</h2>

            <div className="grid sm:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Филиал</label>
                    <select
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        value={branchId}
                        onChange={e=>setBranchId(e.target.value)}
                    >
                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Услуга</label>
                    <select
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        value={serviceId}
                        onChange={e=>setServiceId(e.target.value)}
                    >
                        {servicesByBranch.map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name} ({s.duration_min}м)
                            </option>
                        ))}
                        {servicesByBranch.length===0 && <option value="">Нет услуг в филиале</option>}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Дата</label>
                    <input
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        type="date"
                        value={date}
                        onChange={e=>setDate(e.target.value)}
                    />
                </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Доступные слоты</h3>
                {loading && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Загружаем…
                    </div>
                )}
                {err && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <p className="text-sm text-red-600 dark:text-red-400">Ошибка: {err}</p>
                    </div>
                )}

                {(!loading && uniq.length === 0) && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        Нет свободных слотов на выбранные параметры
                    </div>
                )}

                <div className="flex flex-wrap gap-3">
                    {uniq.map(s => {
                        const label = `${formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}–${formatInTimeZone(new Date(s.end_at), TZ, 'HH:mm')}`;
                        return (
                            <Button
                                key={s.start_at}
                                variant="outline"
                                size="sm"
                                onClick={()=>createBooking(s.start_at)}
                                title="Создать запись в этот слот"
                            >
                                {label}
                            </Button>
                        );
                    })}
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                    Слоты рассчитываются RPC <code className="font-mono text-indigo-600 dark:text-indigo-400">get_free_slots_service_day_v2</code> с учётом правил расписания,
                    родного филиала и существующих броней.
                </p>
            </div>
        </section>
    );
}
