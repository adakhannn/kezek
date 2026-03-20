import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

import { getWeekDates } from '../components/scheduleWeek';
import type { Branch } from '../components/scheduleTypes';

type TransferItem = {
    id: string;
    date_on: string;
    branch_id: string;
    branch_name: string;
};

type UseScheduleTransfersOptions = {
    bizId: string;
    staffId: string;
    homeBranchId: string;
    branches: Branch[];
    t: (key: string, fallback?: string) => string;
};

export function useScheduleTransfers({
    bizId,
    staffId,
    homeBranchId,
    branches,
    t,
}: UseScheduleTransfersOptions) {
    const [transfers, setTransfers] = useState<TransferItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ignore = false;

        (async () => {
            setLoading(true);
            const weekStart = formatInTimeZone(getWeekDates(0)[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(getWeekDates(1)[6], 1), TZ, 'yyyy-MM-dd');

            const { data } = await supabase
                .from('staff_schedule_rules')
                .select('id, date_on, branch_id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('is_active', true)
                .neq('branch_id', homeBranchId)
                .gte('date_on', weekStart)
                .lt('date_on', weekEnd)
                .order('date_on', { ascending: true });

            if (ignore) return;

            const unknownBranchLabel = t('staff.schedule.transfers.unknownBranch', 'Неизвестный филиал');
            const transfersData = (data ?? [])
                .map((rule) => {
                    const branch = branches.find((item) => item.id === rule.branch_id);
                    return {
                        id: rule.id,
                        date_on: rule.date_on,
                        branch_id: rule.branch_id,
                        branch_name: branch?.name || unknownBranchLabel,
                    };
                })
                .filter((transfer) => transfer.branch_name !== unknownBranchLabel);

            setTransfers(transfersData);
            setLoading(false);
        })();

        return () => {
            ignore = true;
        };
    }, [bizId, staffId, homeBranchId, branches, t]);

    return { transfers, loading };
}
