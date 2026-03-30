import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import {
  updateBranch,
  type BranchUpdateAdminLike,
  type BranchUpdateBody,
} from '@/lib/branchUpdateService';

export async function runBranchUpdateHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const branchId = await getRouteParamRequired(context, 'id');
  const { bizId } = await getBizContextForManagers();
  const body = (await req.json().catch(() => ({} as BranchUpdateBody))) as BranchUpdateBody;

  const result = await updateBranch({
    admin: getServiceClient() as unknown as BranchUpdateAdminLike,
    branchId,
    bizId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse();
}
