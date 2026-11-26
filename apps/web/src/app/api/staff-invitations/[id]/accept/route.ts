import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runAcceptStaffInvitationHttp } from '@/lib/staffInvitationsHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, context: unknown) {
    return withRateLimit(
        req,
        routeRateLimit('api/staff-invitations/accept', RateLimitConfigs.normal),
        () => withErrorHandler('StaffInvitationAccept', () => runAcceptStaffInvitationHttp(req, context)),
        '/api/staff-invitations/[id]/accept',
    );
}
