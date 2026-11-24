import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { logError } from '@/lib/log';
import { readPerformanceSnapshot, type PerformanceSnapshot } from '@/lib/performanceStore';
import type { DbClient } from '@/lib/supabaseTypes';

export type PerformanceStatsResult =
    | { ok: true; data: PerformanceSnapshot }
    | { ok: false; error: 'auth' | 'forbidden' | 'service_unavailable'; message: string; status: number };

export async function getPerformanceStatsSnapshot(supabase: Pick<DbClient, 'auth' | 'rpc'>): Promise<PerformanceStatsResult> {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return { ok: false, error: 'auth', message: 'Не авторизован', status: 401 };
        const { isSuperAdmin, error } = await checkCurrentUserIsSuperAdmin(supabase, user.id);
        if (error) {
            logError('PerformanceStats', 'Super admin check failed', error);
            return { ok: false, error: 'service_unavailable', message: 'Не удалось проверить права доступа', status: 503 };
        }
        if (!isSuperAdmin) return { ok: false, error: 'forbidden', message: 'Доступ запрещен', status: 403 };
        return { ok: true, data: await readPerformanceSnapshot() };
    } catch (error) {
        logError('PerformanceStats', 'Failed to read the performance snapshot', error);
        return { ok: false, error: 'service_unavailable', message: 'Общее хранилище метрик недоступно', status: 503 };
    }
}
