import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getIpAddress } from '@/lib/apiMetrics';
import {
  getFrontendMetricType,
  saveFrontendMetric,
  type FrontendMetric,
  type FrontendMetricsAdminLike,
  type FrontendMetricsUserClientLike,
} from '@/lib/frontendMetricsService';
import { logDebug } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export async function runFrontendMetricsHttp(req: Request): Promise<NextResponse> {
  let metric: FrontendMetric;
  try {
    metric = (await req.json()) as FrontendMetric;
  } catch {
    return createErrorResponse('validation', 'Invalid JSON body', undefined, 400);
  }

  if (!metric || typeof metric !== 'object') {
    return createErrorResponse('validation', 'Invalid metric data', undefined, 400);
  }

  saveFrontendMetric(metric, {
    req,
    admin: getServiceClient() as unknown as FrontendMetricsAdminLike,
    userClient: (await createSupabaseServerClient()) as unknown as FrontendMetricsUserClientLike,
    ipAddress: getIpAddress(req) ?? null,
  }).catch(() => {
    // Ignore metric persistence failures to keep endpoint non-blocking.
  });

  if (process.env.NODE_ENV === 'development') {
    logDebug('FrontendMetrics', `Received ${getFrontendMetricType(metric)} metric`, {
      metric,
    });
  }

  return createSuccessResponse({ ok: true });
}
