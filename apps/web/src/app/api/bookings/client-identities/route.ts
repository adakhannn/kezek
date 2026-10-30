import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardBookingClientIdentityHttp } from '@/lib/dashboardBookingClientIdentityHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.normal, () =>
        withErrorHandler('DashboardBookingClientIdentities', () => runDashboardBookingClientIdentityHttp(req)));
}
