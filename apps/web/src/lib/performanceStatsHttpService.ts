import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getPerformanceStatsSnapshot, type PerformanceStatsAuthClientLike } from '@/lib/performanceStatsService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function runPerformanceStatsHttp(): Promise<NextResponse> {
  const result = await getPerformanceStatsSnapshot(
    await createSupabaseServerClient() as unknown as PerformanceStatsAuthClientLike,
  );

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
