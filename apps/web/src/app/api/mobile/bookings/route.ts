export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runListMobileBookingsHttp } from '@/lib/mobileBookingsHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('MobileBookingsList', async () => runListMobileBookingsHttp(req)),
    );
}
