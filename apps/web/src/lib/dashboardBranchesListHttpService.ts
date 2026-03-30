import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { listDashboardBranches } from '@/lib/dashboardBranchesListService';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runDashboardBranchesListHttp(req: Request): Promise<NextResponse> {
  return withManagerContext(req, 'DashboardBranchesList', async ({ supabase, bizId }) => {
    const result = await listDashboardBranches({ supabase, bizId });

    if (!result.ok) {
      return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
  });
}
