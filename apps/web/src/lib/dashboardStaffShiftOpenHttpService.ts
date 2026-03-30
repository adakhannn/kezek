import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runDashboardStaffShiftOpen } from '@/lib/dashboardStaffShiftOpenService';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

export async function runDashboardStaffShiftOpenHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  return withManagerAndStaffContext<{
    id: string;
    biz_id: string | number | null;
    branch_id: string | null;
  }>(
    req,
    context,
    { scope: 'OwnerShiftOpen', staffIdParamName: 'id', staffSelect: 'id, biz_id, branch_id' },
    async ({ supabase, admin, bizId, staffId, staff }) => {
      const result = await runDashboardStaffShiftOpen({
        req,
        supabase,
        admin,
        bizId,
        staffId,
        staff,
      });

      if (!result.ok) {
        return createErrorResponse(result.errorType, result.message, result.details, result.statusCode);
      }

      return createSuccessResponse({ shift: result.shift });
    },
  );
}
