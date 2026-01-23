import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

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
 * Хук для загрузки и управления временными переводами сотрудников
 * Временные переводы определяются через staff_schedule_rules, где branch_id отличается от домашнего филиала сотрудника
 */
export function useTemporaryTransfers(params: {
    branchId: string;
    bizId: string;
    staff: Staff[];
}) {
    const { branchId, bizId, staff } = params;
    const [temporaryTransfers, setTemporaryTransfers] = useState<TemporaryTransfer[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;

        (async () => {
            if (!branchId || !bizId || staff.length === 0) {
                setTemporaryTransfers([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Загружаем временные переводы для всех будущих дат (в пределах 60 дней)
                const now = new Date();
                const maxDate = addDays(now, 60);
                const minDateStr = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
                const maxDateStr = formatInTimeZone(maxDate, TZ, 'yyyy-MM-dd');

                // Создаем мапку staff_id -> home branch_id для определения временных переводов
                const staffHomeBranches = new Map<string, string>();
                for (const s of staff) {
                    staffHomeBranches.set(s.id, s.branch_id);
                }

                // Загружаем все правила расписания для всех сотрудников этого бизнеса на нужный период
                // Важно: загружаем для ВСЕХ филиалов, а не только для выбранного, чтобы корректно определить временные переводы
                const staffIds = Array.from(staffHomeBranches.keys());

                const { data, error: fetchError } = await supabase
                    .from('staff_schedule_rules')
                    .select('staff_id, branch_id, date_on')
                    .eq('biz_id', bizId)
                    .in('staff_id', staffIds)
                    .eq('kind', 'date')
                    .eq('is_active', true)
                    .gte('date_on', minDateStr)
                    .lte('date_on', maxDateStr);

                if (ignore) return;

                if (fetchError) {
                    setError(fetchError.message);
                    setTemporaryTransfers([]);
                    return;
                }

                // Фильтруем: временный перевод = branch_id в правиле отличается от домашнего филиала сотрудника
                const transfers = (data ?? [])
                    .filter((rule: { staff_id: string; branch_id: string; date_on: string }) => {
                        const homeBranchId = staffHomeBranches.get(rule.staff_id);
                        return homeBranchId && rule.branch_id !== homeBranchId;
                    })
                    .map((rule: { staff_id: string; branch_id: string; date_on: string }) => ({
                        staff_id: rule.staff_id,
                        branch_id: rule.branch_id,
                        date: rule.date_on,
                    }));

                setTemporaryTransfers(transfers);
            } catch (err) {
                if (!ignore) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                    setTemporaryTransfers([]);
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [branchId, bizId, staff]);

    return { temporaryTransfers, loading, error };
}

