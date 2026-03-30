import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import {
  getBranchSchedule,
  saveBranchSchedule,
  type BranchScheduleAdminLike,
  type BranchScheduleBody,
} from '@/lib/branchScheduleService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export async function runGetBranchScheduleHttp(
  _req: Request,
  context: unknown,
): Promise<NextResponse> {
  const branchId = await getRouteParamUuid(context, 'id');
  const { bizId } = await getBizContextForManagers();

  const result = await getBranchSchedule({
    admin: getServiceClient() as unknown as BranchScheduleAdminLike,
    branchId,
    bizId,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}

export async function runSaveBranchScheduleHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const branchId = await getRouteParamUuid(context, 'id');
  const { bizId } = await getBizContextForManagers();
  const body = (await req.json()) as BranchScheduleBody;

  const result = await saveBranchSchedule({
    admin: getServiceClient() as unknown as BranchScheduleAdminLike,
    branchId,
    bizId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse();
}
