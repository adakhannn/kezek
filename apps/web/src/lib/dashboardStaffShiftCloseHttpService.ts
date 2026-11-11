import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runDashboardStaffShiftClose } from '@/lib/dashboardStaffShiftCloseService';
import { checkVerifiedPrincipalRateLimit, rateLimitDeniedResponse, RateLimitConfigs } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runDashboardStaffShiftCloseHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const staffId = await getRouteParamUuid(context, 'id');

  return withManagerContext(req, 'DashboardStaffShiftClose', async ({ admin, bizId, userId }) => {
    const limit = await checkVerifiedPrincipalRateLimit(req, '/api/dashboard/staff/[id]/shift/close', { userId, bizId }, RateLimitConfigs.critical);
    if (!limit.success) return rateLimitDeniedResponse(limit);
    const result = await runDashboardStaffShiftClose({
      req,
      admin,
      bizId,
      staffId,
      actorId: userId,
    });

    if (!result.ok) {
      return createErrorResponse(result.errorType, result.message, undefined, result.statusCode);
    }

    return createSuccessResponse({ shift: result.shift });
  });
}
