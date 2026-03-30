import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runRatingsStatusHttp } from '@/lib/ratingsAdminHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('RatingsStatus', async () => runRatingsStatusHttp(req)),
  );
}
