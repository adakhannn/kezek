'use client';

import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';

type Staff = { id: string; full_name: string; branch_id: string; is_active: boolean | null };

export default function ServiceMastersEditor({
                                                 serviceId,
                                                 serviceBranchId,
                                             }: {
    serviceId: string;
    serviceBranchId: string;
}) {
    const [staff, setStaff] = useState<Staff[]>([]);
    const [allowed, setAllowed] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const activeStaff = useMemo(
        () => (staff ?? []).filter(s => s.is_active && s.branch_id === serviceBranchId),
        [staff, serviceBranchId]
    );

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true); setErr(null);

            // Берём всех активных сотрудников ТОЛЬКО этого филиала (фильтровать можно и в запросе)
            const { data: st, error: e1 } = await supabase
                .from('staff')
                .select('id,full_name,branch_id,is_active')
                .eq('branch_id', serviceBranchId)
                .order('full_name');

            const { data: links, error: e2 } = await supabase
                .from('service_staff')
                .select('staff_id')
                .eq('service_id', serviceId);

            if (ignore) return;
            if (e1) { setErr(e1.message); setStaff([]); setAllowed(new Set()); setLoading(false); return; }
            if (e2) { setErr(e2.message); setStaff(st ?? []); setAllowed(new Set()); setLoading(false); return; }

            setStaff(st ?? []);
            setAllowed(new Set((links ?? []).map(r => r.staff_id as string)));
            setLoading(false);
        })();

        return () => { ignore = true; };
    }, [serviceId, serviceBranchId]);

    async function toggle(staffId: string) {
        const has = allowed.has(staffId);
        if (has) {
            const { error } = await supabase
                .from('service_staff')
                .delete()
                .eq('service_id', serviceId)
                .eq('staff_id', staffId);
            if (error) return alert(error.message);
            setAllowed(prev => { const cp = new Set(prev); cp.delete(staffId); return cp; });
        } else {
            const { error } = await supabase
                .from('service_staff')
                .insert({ service_id: serviceId, staff_id: staffId, is_active: true });
            if (error) return alert(error.message);
            setAllowed(prev => new Set(prev).add(staffId));
        }
    }

    if (loading) return <div className="text-sm text-gray-500">Загрузка…</div>;
    if (err) return <div className="text-sm text-red-600">Ошибка: {err}</div>;
    if (activeStaff.length === 0) return <div className="text-sm text-gray-500">В этом филиале нет активных сотрудников.</div>;

    return (
        <div className="space-y-2">
            <div className="font-medium mb-1">Кто выполняет эту услугу</div>
            {activeStaff.map(s => (
                <label key={s.id} className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={allowed.has(s.id)}
                        onChange={() => toggle(s.id)}
                    />
                    <span>{s.full_name}</span>
                </label>
            ))}
        </div>
    );
}
