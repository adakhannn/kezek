import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runDashboardStaffShiftClose } from '@/lib/dashboardStaffShiftCloseService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runDashboardStaffShiftCloseHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const staffId = await getRouteParamUuid(context, 'id');

  return withManagerContext(req, 'DashboardStaffShiftClose', async ({ admin, bizId }) => {
    const result = await runDashboardStaffShiftClose({
      req,
      admin,
      bizId,
      staffId,
    });

    if (!result.ok) {
      return createErrorResponse(result.errorType, result.message, undefined, result.statusCode);
    }

    return createSuccessResponse({ shift: result.shift });
  });
}
