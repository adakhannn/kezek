export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runBookingRescheduleHttp } from '@/lib/bookingRescheduleHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request, context: unknown) {
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        () => withErrorHandler('BookingReschedule', async () => runBookingRescheduleHttp(req, context)),
        '/api/bookings/[id]/reschedule',
    );
}
