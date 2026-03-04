'use client';

import { useEffect, useState } from 'react';

import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

export type TemporaryTransferRow = {
    staff_id: string;
    branch_id: string;
    date: string;
};

type StaffRow = { id: string; branch_id: string };

export function useTemporaryTransfers(bizId: string, date: string, staff: StaffRow[]) {
    const [transfers, setTransfers] = useState<TemporaryTransferRow[]>([]);

    useEffect(() => {
        if (!date || !bizId || staff.length === 0) {
            setTransfers([]);
            return;
        }
        let ignore = false;
        (async () => {
            const staffHomeBranches = new Map<string, string>();
            for (const s of staff) {
                staffHomeBranches.set(s.id, s.branch_id);
            }
            const staffIds = Array.from(staffHomeBranches.keys());
            const { data, error } = await supabase
                .from('staff_schedule_rules')
                .select('staff_id, branch_id, date_on')
                .eq('biz_id', bizId)
                .in('staff_id', staffIds)
                .eq('kind', 'date')
                .eq('is_active', true)
                .eq('date_on', date);
            if (ignore) return;
            if (error) {
                logError('useTemporaryTransfers', 'Error loading temporary transfers', error);
                setTransfers([]);
                return;
            }
            const list = (data ?? [])
                .filter((rule: { staff_id: string; branch_id: string; date_on: string }) => {
                    const homeBranchId = staffHomeBranches.get(rule.staff_id);
                    return homeBranchId && rule.branch_id !== homeBranchId;
                })
                .map((rule: { staff_id: string; branch_id: string; date_on: string }) => ({
                    staff_id: rule.staff_id,
                    branch_id: rule.branch_id,
                    date: rule.date_on,
                }));
            setTransfers(list);
        })();
        return () => {
            ignore = true;
        };
    }, [date, bizId, staff]);

    return transfers;
}
