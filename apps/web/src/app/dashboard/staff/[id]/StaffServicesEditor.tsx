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

    if (loading) return <div className="text-sm text-gray-500">Загрузка…</div>;
    if (err) return <div className="text-sm text-red-600">Ошибка: {err}</div>;
    if (services.length === 0) return <div className="text-sm text-gray-500">В этом филиале нет активных услуг.</div>;

    return (
        <div className="space-y-2">
            <div className="font-medium mb-1">Компетенции мастера (услуги филиала)</div>
            {services.map(s => (
                <label key={s.id} className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={allowed.has(s.id)}
                        onChange={() => toggle(s.id)}
                    />
                    <span>
            {s.name_ru}{' '}
                        <span className="text-gray-500">({s.duration_min} мин)</span>
          </span>
                </label>
            ))}
        </div>
    );
}
