import { getPerformanceStats, getOperations } from '@/lib/performance';
import { checkCurrentUserIsSuperAdmin, type SuperAdminRoleClient } from '@/lib/adminAccess';

export type PerformanceStatsAuthClientLike = SuperAdminRoleClient & {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
    }>;
  };
};

export type PerformanceStatsResult =
  | { ok: true; data: { stats: Array<Record<string, unknown>>; timestamp: number } }
  | { ok: false; error: 'auth' | 'forbidden'; message: string; status: number };

export async function getPerformanceStatsSnapshot(
  supabase: PerformanceStatsAuthClientLike,
): Promise<PerformanceStatsResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'auth',
      message: 'Не авторизован',
      status: 401,
    };
  }

  const { isSuperAdmin } = await checkCurrentUserIsSuperAdmin(supabase, user.id);

  if (!isSuperAdmin) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Доступ запрещен',
      status: 403,
    };
  }

  const operations = getOperations();
  const stats = operations.map((operation) => ({
    operation,
    ...getPerformanceStats(operation, 5 * 60 * 1000),
  }));

  return {
    ok: true,
    data: {
      stats,
      timestamp: Date.now(),
    },
  };
}
