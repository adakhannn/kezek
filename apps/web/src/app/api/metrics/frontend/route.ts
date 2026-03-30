import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runFrontendMetricsHttp } from '@/lib/frontendMetricsHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('FrontendMetrics', async () => runFrontendMetricsHttp(req)),
  );
}
