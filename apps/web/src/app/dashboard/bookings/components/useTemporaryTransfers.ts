'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { logError } from '@/lib/log';
import { loadWorkLocations } from '@/lib/scheduling/locationsClient';

export type TemporaryTransferRow = { staff_id: string; branch_id: string; date: string };
type StaffRow = { id: string; branch_id: string };
const EMPTY_TRANSFERS: TemporaryTransferRow[] = [];

/**
 * The day's temporary transfers for QuickDesk. A failed read is exposed as `error` with a `retry`
 * (FE-08), like the public booking hook: no rows is not the same as "nobody is transferred".
 */
export function useTemporaryTransfers(bizId: string, date: string, staff: StaffRow[]) {
    const staffKey = JSON.stringify(staff.map(({ id, branch_id }) => [id, branch_id]).sort(([a], [b]) => a.localeCompare(b)));
    const requestKey = JSON.stringify([bizId, date, staffKey]);
    const request = useMemo(() => ({ key: requestKey }), [requestKey]);
    const enabled = Boolean(bizId && date && staff.length);
    const [attempt, setAttempt] = useState(0);
    const [snapshot, setSnapshot] = useState<{ request: typeof request; rows: TemporaryTransferRow[]; error: string | null } | null>(null);

    useEffect(() => {
        if (!enabled) return;
        let ignore = false;
        const homes = new Map<string, string>(JSON.parse(staffKey) as Array<[string, string]>);
        void loadWorkLocations(bizId, date, date, true)
            .then(data => {
                if (ignore) return;
                const rows = data.filter(rule => Boolean(homes.get(rule.staff_id)) && rule.branch_id !== homes.get(rule.staff_id))
                    .map(rule => ({ staff_id: rule.staff_id, branch_id: rule.branch_id, date: rule.date_on }));
                setSnapshot({ request, rows, error: null });
            })
            .catch(error => {
                if (ignore) return;
                logError('useTemporaryTransfers', 'Error loading temporary transfers', error);
                setSnapshot({ request, rows: EMPTY_TRANSFERS, error: error instanceof Error ? error.message : 'Unknown error' });
            });
        return () => { ignore = true; };
    }, [bizId, date, staffKey, request, enabled, attempt]);

    const current = enabled && snapshot?.request === request ? snapshot : null;
    const retry = useCallback(() => setAttempt(value => value + 1), []);
    return { rows: current?.rows ?? EMPTY_TRANSFERS, error: current?.error ?? null, retry };
}
