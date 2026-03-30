import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { validateRequest } from '@/lib/validation/apiValidation';
import { visitPackagePlanSchema } from '@/lib/validation/schemas';
import {
  createVisitPackagePlan,
  listVisitPackagePlans,
  type VisitPackagePlansAdminLike,
} from '@/lib/visitPackagePlansService';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runListVisitPackagePlansHttp(req: Request): Promise<NextResponse> {
  return withManagerContext(req, 'VisitPackagePlansList', async ({ admin, bizId }) => {
    const result = await listVisitPackagePlans({
      admin: admin as unknown as VisitPackagePlansAdminLike,
      bizId,
    });

    if (!result.ok) {
      return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
  });
}

export async function runCreateVisitPackagePlanHttp(req: Request): Promise<NextResponse> {
  const validationResult = await validateRequest(req, visitPackagePlanSchema);
  if (!validationResult.success) {
    return validationResult.response;
  }

  return withManagerContext(req, 'VisitPackagePlansCreate', async ({ admin, bizId }) => {
    const result = await createVisitPackagePlan({
      admin: admin as unknown as VisitPackagePlansAdminLike,
      bizId,
      body: validationResult.data,
    });

    if (!result.ok) {
      return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
  });
}
