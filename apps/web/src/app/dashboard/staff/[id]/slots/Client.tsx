'use client';

import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useMemo, useState } from 'react';

import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

// Helper для конвертации Date в YYYY-MM-DD
function toYmdLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

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
                        <DatePickerPopover
                            value={date}
                            onChange={setDate}
                            min={toYmdLocal(new Date())}
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
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Найдено свободных слотов: <span className="font-semibold text-gray-900 dark:text-gray-100">{uniq.length}</span>
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2.5">
                            {uniq.map(s => {
                                const label = `${formatInTimeZone(new Date(s.start_at), TZ, 'HH:mm')}–${formatInTimeZone(new Date(s.end_at), TZ, 'HH:mm')}`;
                                return (
                                    <button
                                        key={s.start_at}
                                        className="group inline-flex items-center gap-2 rounded-xl border-2 border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md active:scale-95 dark:border-indigo-800 dark:bg-gray-800 dark:text-indigo-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40"
                                        onClick={() => createBooking(s.start_at)}
                                        title="Создать запись в этот слот"
                                    >
                                        <svg className="w-4 h-4 flex-shrink-0 text-indigo-500 group-hover:text-indigo-600 dark:text-indigo-400 dark:group-hover:text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

        </section>
    );
}
