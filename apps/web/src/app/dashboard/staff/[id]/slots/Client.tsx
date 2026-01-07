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
        <section className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800 space-y-6">
            {/* Фильтры */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Фильтры
                </h2>
                <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Филиал
                        </label>
                        <select
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Услуга
                        </label>
                        <select
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={serviceId}
                            onChange={e => setServiceId(e.target.value)}
                        >
                            {servicesByBranch.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.duration_min} мин)
                                </option>
                            ))}
                            {servicesByBranch.length === 0 && (
                                <option value="">Нет услуг в филиале</option>
                            )}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Дата
                        </label>
                        <input
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Свободные слоты */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Свободные слоты
                </h3>
                
                {loading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Загружаем свободные слоты...
                    </div>
                )}
                
                {err && (
                    <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3">
                        <p className="text-sm text-red-600 dark:text-red-400">Ошибка: {err}</p>
                    </div>
                )}

                {!loading && !err && uniq.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 px-4 py-8 text-center">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Нет свободных слотов</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                            Нет свободных слотов на выбранные параметры. Попробуйте выбрать другой день или услугу.
                        </p>
                    </div>
                )}

                {!loading && !err && uniq.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {uniq.map(s => {
                            const label = `${formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}–${formatInTimeZone(new Date(s.end_at), TZ, 'HH:mm')}`;
                            return (
                                <button
                                    key={s.start_at}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
                                    onClick={() => createBooking(s.start_at)}
                                    title="Создать запись в этот слот"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Информационный блок */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3">
                <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                        <p className="font-medium mb-1">Как рассчитываются слоты</p>
                        <p className="text-blue-700 dark:text-blue-300">
                            Слоты рассчитываются RPC <code className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40">get_free_slots_service_day_v2</code> с учётом правил расписания, родного филиала и существующих броней.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
