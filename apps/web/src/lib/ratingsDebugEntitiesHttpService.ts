import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import {
    ensureSuperAdminAccess,
    getRatingsDebugEntities,
} from '@/lib/ratingsDebugEntitiesService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { addDaysToDateString, getTimezone, todayDateString } from '@/lib/time';

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90;

export async function runRatingsDebugEntitiesHttp(req: Request): Promise<NextResponse> {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const accessResult = await ensureSuperAdminAccess({
        supabase: supabase as never,
    });
    if (!accessResult.ok) {
        return createErrorResponse(
            accessResult.error,
            accessResult.message,
            undefined,
            accessResult.status,
        );
    }

    const daysParam = new URL(req.url).searchParams.get('days');
    const days = Math.min(
        MAX_DAYS,
        Math.max(1, Number.parseInt(daysParam ?? String(DEFAULT_DAYS), 10) || DEFAULT_DAYS),
    );

    const tz = getTimezone();
    const result = await getRatingsDebugEntities({
        admin: getServiceClient() as never,
        days,
        windowStartStr: addDaysToDateString(todayDateString(tz), -days, tz),
    });

    return createSuccessResponse(result.data);
}
