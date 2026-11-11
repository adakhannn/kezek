import { NextResponse } from 'next/server';


import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runCloseShiftsCron } from '@/lib/closeShiftsCronService';
import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { getServiceClient } from '@/lib/supabaseService';

export async function runCloseShiftsCronHttp(
    req: Request,
    cronSecret: string | undefined,
): Promise<NextResponse> {
    if (!isAuthorizedCronRequest(req, cronSecret)) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    return trackCronExecution('close-shifts', async () => {

    const result = await runCloseShiftsCron({ supabase: getServiceClient() });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
    });
}
