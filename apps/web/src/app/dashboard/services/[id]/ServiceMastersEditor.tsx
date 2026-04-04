'use client';

import { useEffect, useMemo, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabaseClient';

type Staff = { id: string; full_name: string; branch_id: string; is_active: boolean | null };

export default function ServiceMastersEditor({
    serviceId,
    serviceBranchId,
}: {
    serviceId: string;
    serviceBranchId: string;
}) {
    const { t } = useLanguage();
    const toast = useToast();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [allowed, setAllowed] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    const activeStaff = useMemo(
        () => (staff ?? []).filter((s) => s.is_active && s.branch_id === serviceBranchId),
        [staff, serviceBranchId],
    );

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            setErr(null);

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
            if (e1) {
                setErr(e1.message);
                setStaff([]);
                setAllowed(new Set());
                setLoading(false);
                return;
            }
            if (e2) {
                setErr(e2.message);
                setStaff(st ?? []);
                setAllowed(new Set());
                setLoading(false);
                return;
            }

            setStaff(st ?? []);
            setAllowed(new Set((links ?? []).map((r) => r.staff_id as string)));
            setLoading(false);
        })();

        return () => {
            ignore = true;
        };
    }, [serviceId, serviceBranchId]);

    async function toggle(staffId: string) {
        const has = allowed.has(staffId);
        if (has) {
            const { error } = await supabase
                .from('service_staff')
                .delete()
                .eq('service_id', serviceId)
                .eq('staff_id', staffId);
            if (error) {
                toast.showError(error.message);
                return;
            }
            setAllowed((prev) => {
                const cp = new Set(prev);
                cp.delete(staffId);
                return cp;
            });
        } else {
            const { error } = await supabase
                .from('service_staff')
                .insert({ service_id: serviceId, staff_id: staffId, is_active: true });
            if (error) {
                toast.showError(error.message);
                return;
            }
            setAllowed((prev) => new Set(prev).add(staffId));
        }
    }

    if (loading) {
        return (
            <div className="text-sm text-gray-500">
                {t('services.masters.loading', 'Р—Р°РіСЂСѓР·РєР°вЂ¦')}
            </div>
        );
    }
    if (err) {
        return (
            <div className="text-sm text-red-600">
                {t('services.masters.error', 'РћС€РёР±РєР°:')} {err}
            </div>
        );
    }
    if (activeStaff.length === 0) {
        return (
            <div className="text-sm text-gray-500">
                {t('services.masters.empty', 'Р’ СЌС‚РѕРј С„РёР»РёР°Р»Рµ РЅРµС‚ Р°РєС‚РёРІРЅС‹С… СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ.')}
            </div>
        );
    }

    return (
        <>
            <div className="space-y-2">
                {activeStaff.map((s) => (
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
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
