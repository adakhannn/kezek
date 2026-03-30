import { getPerformanceStats, getOperations } from '@/lib/performance';

export type PerformanceStatsAuthClientLike = {
  auth: {
    getUser: () => Promise<{
      data: { user: { id: string } | null };
    }>;
  };
  from: (table: string) => {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        maybeSingle: () => Promise<{
          data: { is_super_admin?: boolean } | null;
          error: null;
        }>;
      };
    };
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_super_admin) {
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
