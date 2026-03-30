import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { recalcHourlyForDate } from '@/lib/analyticsHourlyLoadCronService';
import { logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import {
    addDaysToDateString,
    dateRangeInclusive,
    getTimezone,
    todayDateString,
} from '@/lib/time';

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function runAnalyticsHourlyLoadCronHttp(
    req: Request,
    cronSecret: string | undefined,
): Promise<NextResponse> {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const url = new URL(req.url);
    const startParam = url.searchParams.get('startDate');
    const endParam = url.searchParams.get('endDate');
    const tz = getTimezone();

    const days =
        startParam &&
        endParam &&
        YMD_REGEX.test(startParam) &&
        YMD_REGEX.test(endParam) &&
        startParam <= endParam
            ? dateRangeInclusive(startParam, endParam, tz)
            : [addDaysToDateString(todayDateString(tz), -1, tz)];

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
}
