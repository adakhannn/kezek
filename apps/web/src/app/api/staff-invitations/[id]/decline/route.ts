import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runDeclineStaffInvitationHttp } from '@/lib/staffInvitationsHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, context: unknown) {
    return withRateLimit(
        req,
        routeRateLimit('api/staff-invitations/decline', RateLimitConfigs.normal),
        () => withErrorHandler('StaffInvitationDecline', () => runDeclineStaffInvitationHttp(req, context)),
        '/api/staff-invitations/[id]/decline',
    );
}
