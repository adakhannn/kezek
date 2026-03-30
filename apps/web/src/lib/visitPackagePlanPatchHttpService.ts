import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getRouteParamUuid } from '@/lib/routeParams';
import { validateRequest } from '@/lib/validation/apiValidation';
import { visitPackagePlanPatchSchema } from '@/lib/validation/schemas';
import {
  type VisitPackagePlansAdminLike,
  updateVisitPackagePlan,
} from '@/lib/visitPackagePlansService';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runVisitPackagePlanPatchHttp(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const planId = await getRouteParamUuid(context, 'id');
  const validationResult = await validateRequest(req, visitPackagePlanPatchSchema);
  if (!validationResult.success) {
    return validationResult.response;
  }

  return withManagerContext(req, 'VisitPackagePlanPatch', async ({ admin, bizId }) => {
    const result = await updateVisitPackagePlan({
      admin: admin as unknown as VisitPackagePlansAdminLike,
      planId,
      bizId,
      body: validationResult.data,
    });

    if (!result.ok) {
      return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
  });
}
