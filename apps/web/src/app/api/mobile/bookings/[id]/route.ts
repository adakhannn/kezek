export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runGetMobileBookingDetailsHttp } from '@/lib/mobileBookingsHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function GET(req: Request, context: unknown) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('MobileBookingDetails', async () => runGetMobileBookingDetailsHttp(req, context)),
    );
}
