import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { runStaffDeleteService } from '@/lib/staffDeleteService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runStaffDeleteHttp(context: unknown): Promise<NextResponse> {
  const staffId = await getRouteParamUuid(context, 'id');
  const { bizId } = await getBizContextForManagers();

  // The database command deletes only a master without history, in one transaction; with
  // either schedule mode a master who has bookings, shifts or published schedules is refused.
  const result = await runStaffDeleteService({
    admin: getServiceClient(),
    bizId,
    staffId,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse();
}
