import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runAnalyticsDailyCron } from '@/lib/analyticsDailyCronService';
import { getServiceClient } from '@/lib/supabaseService';
import { getTimezone } from '@/lib/time';

export async function runAnalyticsDailyCronHttp(
    req: Request,
    cronSecret: string | undefined,
): Promise<NextResponse> {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return createErrorResponse('auth', 'РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ', undefined, 401);
    }

    const url = new URL(req.url);
    const result = await runAnalyticsDailyCron({
        supabase: getServiceClient(),
        tz: getTimezone(),
        startDate: url.searchParams.get('startDate'),
        endDate: url.searchParams.get('endDate'),
    });

    return createSuccessResponse(result.data);
}
