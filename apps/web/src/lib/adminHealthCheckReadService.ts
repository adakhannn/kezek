import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { runAdminHealthCheck } from '@/lib/adminHealthCheckService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

type CallerReadResult = Awaited<ReturnType<typeof runAdminHealthCheck>> | {
  ok: false;
  statusCode: 400 | 401 | 403;
  errorType: 'auth' | 'forbidden' | 'internal';
  message: string;
};

/** Shared request-context read for the server page and HTTP adapter. */
export async function readAdminHealthCheckForCaller(): Promise<CallerReadResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, statusCode: 401, errorType: 'auth', message: 'Не авторизован' };
  }

  const { isSuperAdmin, error } = await checkCurrentUserIsSuperAdmin(
    supabase,
    user.id,
  );
  if (error) {
    return { ok: false, statusCode: 400, errorType: 'internal', message: 'Не удалось проверить права доступа' };
  }
  if (!isSuperAdmin) {
    return { ok: false, statusCode: 403, errorType: 'forbidden', message: 'Доступ запрещен' };
  }

  return runAdminHealthCheck({ admin: getServiceClient() });
}
