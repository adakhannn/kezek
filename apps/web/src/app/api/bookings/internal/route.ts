import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runInternalBookingHttp } from '@/lib/internalBookingHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.normal, () =>
        withErrorHandler('InternalBooking', () => runInternalBookingHttp(req)), '/api/bookings/internal');
}
