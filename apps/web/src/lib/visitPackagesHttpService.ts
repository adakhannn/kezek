import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { validateQuery, validateRequest } from '@/lib/validation/apiValidation';
import { sellVisitPackageSchema, visitPackagesListQuerySchema } from '@/lib/validation/schemas';
import {
  listVisitPackages,
  sellVisitPackage,
  type VisitPackagesAdminLike,
} from '@/lib/visitPackagesService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runListVisitPackagesHttp(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const queryResult = validateQuery(url, visitPackagesListQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  return withManagerContext(req, 'VisitPackagesList', async ({ admin, bizId }) => {
    const result = await listVisitPackages({
      admin: admin as unknown as VisitPackagesAdminLike,
      bizId,
      query: queryResult.data,
    });

    if (!result.ok) {
      return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
  });
}

export async function runSellVisitPackageHttp(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  const clientId = await getRouteParamUuid(context, 'clientId');
  const validationResult = await validateRequest(req, sellVisitPackageSchema);
  if (!validationResult.success) {
    return validationResult.response;
  }

  return withManagerContext(req, 'SellVisitPackage', async ({ admin, bizId }) => {
    const result = await sellVisitPackage({
      admin: admin as unknown as VisitPackagesAdminLike,
      bizId,
      clientId,
      body: validationResult.data,
    });

    if (!result.ok) {
      return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
  });
}
