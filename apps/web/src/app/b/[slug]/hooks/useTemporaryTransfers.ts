import { useEffect, useMemo, useState } from 'react';

import { loadWorkLocationSnapshot, type WorkLocation } from '@/lib/scheduling/locationsClient';

type TemporaryTransfer = {
    staff_id: string;
    branch_id: string;
    date: string;
};

type Staff = {
    id: string;
    branch_id: string;
};

/**
 * Load only the selected day's minimal effective work locations. Legacy responses
 * explicitly remain transfer-only; never infer a working day from a home branch.
 */
export function useTemporaryTransfers(params: {
    branchId: string;
    bizId: string;
    staff: Staff[];
    dayStr: string;
}) {
    const { branchId, bizId, staff, dayStr } = params;
    const key = `${bizId}|${branchId}|${dayStr}`;
    const enabled = !!branchId && !!bizId && !!dayStr;
    const [snapshot, setSnapshot] = useState<{
        key: string; locations: WorkLocation[]; complete: boolean; error: string | null;
    } | null>(null);

    useEffect(() => {
        let ignore = false;

        (async () => {
            if (!enabled) return;

            try {
                const result = await loadWorkLocationSnapshot(bizId, dayStr, dayStr);
                if (!ignore) setSnapshot({ key, ...result, error: null });
            } catch (err) {
                if (!ignore) {
                    setSnapshot({ key, locations: [], complete: false,
                        error: err instanceof Error ? err.message : 'Unknown error' });
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [bizId, dayStr, enabled, key]);

    const current = enabled && snapshot?.key === key ? snapshot : null;
    const locations = useMemo<TemporaryTransfer[]>(() => (current?.locations ?? []).map(row => ({
        staff_id: row.staff_id, branch_id: row.branch_id, date: row.date_on,
    })), [current]);
    const temporaryTransfers = useMemo(() => {
        const home = new Map(staff.map(member => [member.id, member.branch_id]));
        return locations.filter(row => home.has(row.staff_id) && home.get(row.staff_id) !== row.branch_id);
    }, [locations, staff]);
    return { temporaryTransfers, workingLocations: current?.complete ? locations : undefined,
        loading: enabled && current === null, error: current?.error ?? null };
}

