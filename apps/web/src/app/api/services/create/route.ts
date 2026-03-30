// apps/web/src/app/api/services/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runServiceCreateHttp } from '@/lib/serviceCreateHttpService';

export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('ServicesCreate', async () => runServiceCreateHttp(req)),
  );
}
