'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { logWarn } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

type StaffRow = { id: string };
type ServiceStaffRow = { service_id: string; staff_id: string; is_active: boolean };

/**
 * Service-staff links for QuickDesk. A failed read is reported as `error` (FE-08): without the map
 * `filterServicesForStaff` would offer every branch service, so the caller fails closed and retries.
 */
export function useServiceStaffMap(staff: StaffRow[]) {
    const [serviceStaff, setServiceStaff] = useState<ServiceStaffRow[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let ignore = false;
        (async () => {
            const staffIds = staff.map((s) => s.id);
            if (staffIds.length === 0) {
                setServiceStaff([]);
                setFailed(false);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('service_staff')
                    .select('service_id,staff_id,is_active')
                    .eq('is_active', true)
                    .in('staff_id', staffIds);
                if (ignore) return;
                if (error) throw error;
                setServiceStaff((data ?? []) as ServiceStaffRow[]);
                setFailed(false);
            } catch (error) {
                if (ignore) return;
                logWarn('useServiceStaffMap', 'service_staff read error', error);
                setServiceStaff(null);
                setFailed(true);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [staff, attempt]);

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

    const retry = useCallback(() => setAttempt((value) => value + 1), []);
    return { serviceToStaffMap, error: failed, retry };
}
