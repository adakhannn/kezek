import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { getGlobalOverview, type GlobalOverviewClient } from '@/lib/adminGlobalOverviewService';
import { ReportRangeError } from '@/lib/analyticsReportSnapshot';
import { getCached, setCached } from '@/lib/simpleCache';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export async function readGlobalOverviewForCaller(startDate: string, endDate: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false as const, error: 'auth', message: 'Не авторизован', status: 401 };
  const { isSuperAdmin, error } = await checkCurrentUserIsSuperAdmin(supabase, user.id);
  if (error) return { ok: false as const, error: 'internal', message: 'Не удалось проверить права доступа', status: 400 };
  if (!isSuperAdmin) return { ok: false as const, error: 'forbidden', message: 'Доступ запрещен', status: 403 };
  const key = `admin_global_overview:v1:${startDate}:${endDate}`;
  const cached = getCached<Awaited<ReturnType<typeof getGlobalOverview>>>(key);
  if (cached) return { ok: true as const, data: cached };
  try {
    const data = await getGlobalOverview(getServiceClient() as unknown as GlobalOverviewClient, startDate, endDate);
    setCached(key, data, 60_000);
    return { ok: true as const, data };
  } catch (error) {
    if (error instanceof ReportRangeError) return { ok: false as const, error: 'validation', message: error.message, status: 400 };
    return { ok: false as const, error: 'internal', message: 'Не удалось загрузить сводный обзор', status: 500 };
  }
}
