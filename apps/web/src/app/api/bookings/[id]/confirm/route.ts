export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runConfirmBookingHttp } from '@/lib/mobileManagerHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request, context: unknown) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('BookingsConfirm', async () => runConfirmBookingHttp(req, context)),
        "/api/bookings/[id]/confirm",
    );
}
