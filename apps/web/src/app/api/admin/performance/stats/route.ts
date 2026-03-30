// apps/web/src/app/api/admin/performance/stats/route.ts
import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runPerformanceStatsHttp } from '@/lib/performanceStatsHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/performance/stats
 * Возвращает статистику производительности для всех операций
 */
export async function GET(req: Request) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('PerformanceStats', async () => runPerformanceStatsHttp()),
  );
}
