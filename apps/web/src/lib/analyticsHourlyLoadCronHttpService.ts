import { NextResponse } from 'next/server';

import { recalcHourlyForDate } from '@/lib/analyticsHourlyLoadCronService';
import { analyticsReportDates } from '@/lib/analyticsReportDates';
import { ReportRangeError } from '@/lib/analyticsReportSnapshot';
import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import {
    getTimezone,
    todayDateString,
} from '@/lib/time';


export async function runAnalyticsHourlyLoadCronHttp(
    req: Request,
    cronSecret: string | undefined,
): Promise<NextResponse> {
    if (!isAuthorizedCronRequest(req, cronSecret)) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    return trackCronExecution('analytics-hourly-load', async () => {

    const url = new URL(req.url);
    const startParam = url.searchParams.get('startDate');
    const endParam = url.searchParams.get('endDate');
    const tz = getTimezone();

    let days: string[];
    try { days = analyticsReportDates(todayDateString(tz), tz, startParam, endParam); }
    catch (error) {
        if (error instanceof ReportRangeError) return createErrorResponse('validation', error.message, undefined, 400);
        throw error;
    }

    const supabase = getServiceClient();
    const results: Array<{ date: string; updated: number }> = [];

    for (const day of days) {
        results.push(await recalcHourlyForDate({ supabase: supabase as never, dateStr: day }));
    }

    logDebug('AnalyticsHourlyCron', 'Completed hourly load aggregation', {
        days: results.length,
        range: days,
    });

    return createSuccessResponse({
        message: 'Analytics hourly load aggregation completed',
        results,
    });
    });
}
