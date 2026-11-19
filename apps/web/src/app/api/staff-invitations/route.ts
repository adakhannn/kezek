import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runListStaffInvitationsHttp } from '@/lib/staffInvitationsHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withRateLimit(
        req,
        routeRateLimit('api/staff-invitations', RateLimitConfigs.normal),
        () => withErrorHandler('StaffInvitationsList', () => runListStaffInvitationsHttp()),
        '/api/staff-invitations',
    );
}
