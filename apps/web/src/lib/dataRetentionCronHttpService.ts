import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { runDataRetention } from '@/lib/dataRetentionCronService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runDataRetentionCronHttp(
    req: Request,
    cronSecret: string | undefined,
): Promise<NextResponse> {
    if (!isAuthorizedCronRequest(req, cronSecret)) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    return trackCronExecution('data-retention', async () => {

    const result = await runDataRetention({
        supabase: getServiceClient(),
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
    });
}
