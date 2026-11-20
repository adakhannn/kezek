export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runStaffInvitationCancelHttp } from '@/lib/staffInvitationCancelHttpService';

export async function POST(req: Request, context: unknown) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('StaffInvitationCancel', () => runStaffInvitationCancelHttp(context)),
        '/api/staff/[id]/invitation/cancel',
    );
}
