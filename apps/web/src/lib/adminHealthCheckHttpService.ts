import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { readAdminHealthCheckForCaller } from '@/lib/adminHealthCheckReadService';

export async function runAdminHealthCheckHttp(): Promise<NextResponse> {
  const result = await readAdminHealthCheckForCaller();
  if (!result.ok) {
    return createErrorResponse(result.errorType, result.message, undefined, result.statusCode);
  }

  return createSuccessResponse(result.data);
}
