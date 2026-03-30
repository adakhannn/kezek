// apps/web/src/app/api/mobile/businesses/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runMobileBusinessesHttp } from '@/lib/mobileBusinessesHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        () =>
            withErrorHandler('MobileBusinesses', async () => runMobileBusinessesHttp(req)),
    );
}
