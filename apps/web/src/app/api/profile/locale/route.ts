export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runProfileLocaleHttp } from '@/lib/profileLocaleHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

/** Saves the signed-in user's site language for their booking notifications (FE-10). */
export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('ProfileLocale', async () => runProfileLocaleHttp(req)),
      "/api/profile/locale",
  );
}
