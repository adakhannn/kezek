import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getPerformanceStatsSnapshot, type PerformanceStatsAuthClientLike } from '@/lib/performanceStatsService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runPerformanceStatsHttp(): Promise<NextResponse> {
  const result = await getPerformanceStatsSnapshot(
    getServiceClient() as unknown as PerformanceStatsAuthClientLike,
  );

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
