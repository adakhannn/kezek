import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import {
  updateBranch,
  type BranchUpdateAdminLike,
} from '@/lib/branchUpdateService';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { branchUpdateSchema } from '@/lib/validation/businessUpdateSchemas';

export async function runBranchUpdateHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const branchId = await getRouteParamRequired(context, 'id');
  const { bizId } = await getBizContextForManagers();
  const validation = await validateRequest(req, branchUpdateSchema);
  if (!validation.success) return validation.response;

  const result = await updateBranch({
    admin: getServiceClient() as unknown as BranchUpdateAdminLike,
    branchId,
    bizId,
    body: validation.data,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse();
}
