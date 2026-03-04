'use client';

import { useEffect, useMemo, useState } from 'react';

import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type StaffRow = { id: string };

export function useServiceStaffMap(staff: StaffRow[]) {
    const [serviceStaff, setServiceStaff] = useState<
        Array<{ service_id: string; staff_id: string; is_active: boolean }> | null
    >(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            const staffIds = staff.map((s) => s.id);
            if (staffIds.length === 0) {
                setServiceStaff([]);
                return;
            }
            const { data, error } = await supabase
                .from('service_staff')
                .select('service_id,staff_id,is_active')
                .eq('is_active', true)
                .in('staff_id', staffIds);
            if (ignore) return;
            if (error) {
                logWarn('useServiceStaffMap', 'service_staff read error', error);
                setServiceStaff(null);
            } else {
                setServiceStaff((data ?? []) as Array<{ service_id: string; staff_id: string; is_active: boolean }>);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [staff]);

    const serviceToStaffMap = useMemo(() => {
        if (!serviceStaff || serviceStaff.length === 0) return null;
        const map = new Map<string, Set<string>>();
        for (const row of serviceStaff) {
            if (!row.is_active) continue;
            if (!map.has(row.service_id)) map.set(row.service_id, new Set());
            map.get(row.service_id)!.add(row.staff_id);
        }
        return map;
    }, [serviceStaff]);

    return serviceToStaffMap;
}
