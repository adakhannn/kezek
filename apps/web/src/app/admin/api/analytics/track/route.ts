import { runAnalyticsTrackHttp } from '@/lib/analyticsTrackHttpService';
import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Public analytics beacon: limited, bounded and closed to server-only events (API-09).
export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.telemetry, () =>
    withErrorHandler('AnalyticsTrackEvent', async () => runAnalyticsTrackHttp(req)),
    '/admin/api/analytics/track',
  );
}
