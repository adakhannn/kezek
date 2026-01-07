'use client';

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

type Service = { id: string; name_ru: string; duration_min: number; branch_id: string; active: boolean };

export default function StaffServicesEditor({
                                                staffId,
                                                staffBranchId,
                                            }: {
    staffId: string;
    staffBranchId: string;
}) {
    const [services, setServices] = useState<Service[]>([]);
    const [allowed, setAllowed] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true); setErr(null);
            // Услуги только родного филиала сотрудника
            const { data: svc, error: e1 } = await supabase
                .from('services')
                .select('id,name_ru,duration_min,branch_id,active')
                .eq('branch_id', staffBranchId)
                .eq('active', true)
                .order('name_ru');

            const { data: links, error: e2 } = await supabase
                .from('service_staff')
                .select('service_id')
                .eq('staff_id', staffId);

            if (ignore) return;
            if (e1) { setErr(e1.message); setServices([]); setAllowed(new Set()); setLoading(false); return; }
            if (e2) { setErr(e2.message); setServices(svc ?? []); setAllowed(new Set()); setLoading(false); return; }

            setServices(svc ?? []);
            setAllowed(new Set((links ?? []).map(r => r.service_id as string)));
            setLoading(false);
        })();

        return () => { ignore = true; };
    }, [staffId, staffBranchId]);

    async function toggle(serviceId: string) {
        const has = allowed.has(serviceId);
        if (has) {
            const { error } = await supabase
                .from('service_staff')
                .delete()
                .eq('service_id', serviceId)
                .eq('staff_id', staffId);
            if (error) return alert(error.message);
            setAllowed(prev => {
                const cp = new Set(prev); cp.delete(serviceId); return cp;
            });
        } else {
            const { error } = await supabase
                .from('service_staff')
                .insert({ service_id: serviceId, staff_id: staffId, is_active: true });
            if (error) return alert(error.message);
            setAllowed(prev => new Set(prev).add(serviceId));
        }
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Загрузка услуг...
            </div>
        );
    }
    if (err) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3">
                <p className="text-sm text-red-600 dark:text-red-400">Ошибка: {err}</p>
            </div>
        );
    }
    if (services.length === 0) {
        return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-3">
                <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">В этом филиале нет активных услуг</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Создайте услуги в разделе «Услуги», чтобы назначить их сотруднику</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Выберите услуги, которые выполняет этот сотрудник. От выбранных услуг зависит, какие услуги клиенты смогут выбрать при записи к этому сотруднику.
            </p>
            <div className="grid gap-2">
                {services.map(s => {
                    const isChecked = allowed.has(s.id);
                    return (
                        <label
                            key={s.id}
                            className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                                isChecked
                                    ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/20'
                            }`}
                        >
                            <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggle(s.id)}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <div className="flex-1">
                                <span className={`text-sm font-medium ${isChecked ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {s.name_ru}
                                </span>
                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                    {s.duration_min} мин
                                </span>
                            </div>
                            {isChecked && (
                                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </label>
                    );
                })}
            </div>
            {allowed.size > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                    Выбрано услуг: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{allowed.size}</span> из {services.length}
                </p>
            )}
        </div>
    );
}
