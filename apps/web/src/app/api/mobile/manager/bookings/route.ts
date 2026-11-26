export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runListManagerBookingsHttp } from '@/lib/mobileManagerHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('MobileManagerBookings', async () => runListManagerBookingsHttp(req)),
        "/api/mobile/manager/bookings",
    );
}
