// apps/web/src/app/api/reviews/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runReviewCreateHttp } from '@/lib/reviewCreateHttpService';

export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('ReviewsCreate', async () => runReviewCreateHttp(req)),
  );
}
