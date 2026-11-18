import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runSetCurrentStaffHttp } from '@/lib/currentStaffHttpService';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withRateLimit(
        req,
        routeRateLimit('api/me/current-staff', RateLimitConfigs.normal),
        () => withErrorHandler('SetCurrentStaff', async () => runSetCurrentStaffHttp(req)),
        '/api/me/current-staff',
    );
}
