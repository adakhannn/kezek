import { isUuid } from '@shared-client/validation';
import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getRouteParamUuid } from '@/lib/routeParams';
import { validateQuery, validateRequest } from '@/lib/validation/apiValidation';
import { sellVisitPackageSchema, visitPackagesListQuerySchema } from '@/lib/validation/schemas';
import {
  listVisitPackages,
  sellVisitPackage,
} from '@/lib/visitPackagesService';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runListVisitPackagesHttp(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const queryResult = validateQuery(url, visitPackagesListQuerySchema);
  if (!queryResult.success) {
    return queryResult.response;
  }

  return withManagerContext(req, 'VisitPackagesList', async ({ admin, bizId }) => {
    const result = await listVisitPackages({
      admin,
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
  // One key per sale attempt (API-11); requests from older pages without it are still accepted.
  const requestId = req.headers.get('idempotency-key')?.trim() || null;
  if (requestId && !isUuid(requestId)) {
    return createErrorResponse('validation', 'Некорректный заголовок Idempotency-Key', undefined, 400);
  }
  const validationResult = await validateRequest(req, sellVisitPackageSchema);
  if (!validationResult.success) {
    return validationResult.response;
  }

  return withManagerContext(req, 'SellVisitPackage', async ({ admin, bizId }) => {
    const result = await sellVisitPackage({
      admin,
      bizId,
      clientId,
      body: validationResult.data,
      requestId,
    });

    if (!result.ok) {
      return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
  });
}
