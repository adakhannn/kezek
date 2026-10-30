import { checkCurrentUserIsSuperAdmin, type SuperAdminRoleClient } from '@/lib/adminAccess';
import { getRatingsJobs } from '@/lib/ratingsJobsService';
import { getRatingsStatus, type RatingsStatusAdminQueryLike } from '@/lib/ratingsStatusService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

async function getCallerAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'auth', message: 'Не авторизован', status: 401 };
  const { isSuperAdmin, error } = await checkCurrentUserIsSuperAdmin(supabase as unknown as SuperAdminRoleClient, user.id);
  if (error) return { ok: false as const, error: 'internal', message: 'Не удалось проверить права доступа', status: 400 };
  if (!isSuperAdmin) return { ok: false as const, error: 'forbidden', message: 'Доступ запрещен', status: 403 };
  return { ok: true as const, admin: getServiceClient() };
}

export async function readRatingsStatusForCaller(errorsWindowDaysParam: string | null = null) {
  const caller = await getCallerAdmin();
  if (!caller.ok) return caller;
  const data = await getRatingsStatus(caller.admin as unknown as RatingsStatusAdminQueryLike, { errorsWindowDaysParam });
  return { ok: true as const, data };
}

export async function readRatingsJobsForCaller() {
  const caller = await getCallerAdmin();
  if (!caller.ok) return caller;
  return getRatingsJobs({ admin: caller.admin as never });
}
