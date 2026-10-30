import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { readRatingsStatusForCaller, readRatingsJobsForCaller } from '@/lib/ratingsAdminReadService';

export async function runRatingsStatusHttp(req: Request): Promise<NextResponse> {
  const errorsWindowDaysParam = new URL(req.url).searchParams.get('errors_days');
  const result = await readRatingsStatusForCaller(errorsWindowDaysParam);
  if (!result.ok) return createErrorResponse(result.error, result.message, undefined, result.status);
  return createSuccessResponse(result.data);
}

export async function runRatingsJobsHttp(): Promise<NextResponse> {
  const result = await readRatingsJobsForCaller();

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}

