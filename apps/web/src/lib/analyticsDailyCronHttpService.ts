import { NextResponse } from 'next/server';

import { runAnalyticsDailyCron } from '@/lib/analyticsDailyCronService';
import { ReportRangeError } from '@/lib/analyticsReportSnapshot';
import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { getServiceClient } from '@/lib/supabaseService';
import { getTimezone } from '@/lib/time';

export async function runAnalyticsDailyCronHttp(
    req: Request,
    cronSecret: string | undefined,
): Promise<NextResponse> {
    if (!isAuthorizedCronRequest(req, cronSecret)) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    return trackCronExecution('analytics-daily', async () => {

    const url = new URL(req.url);
    let result;
    try { result = await runAnalyticsDailyCron({
        supabase: getServiceClient(),
        tz: getTimezone(),
        startDate: url.searchParams.get('startDate'),
        endDate: url.searchParams.get('endDate'),
    }); }
    catch (error) {
        if (error instanceof ReportRangeError) return createErrorResponse('validation', error.message, undefined, 400);
        throw error;
    }

    return createSuccessResponse(result.data);
    });
}
