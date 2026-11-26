export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runListManagedBusinessesHttp } from '@/lib/mobileManagerHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('MobileManagerBusinesses', async () => runListManagedBusinessesHttp(req)),
        "/api/mobile/manager/businesses",
    );
}
