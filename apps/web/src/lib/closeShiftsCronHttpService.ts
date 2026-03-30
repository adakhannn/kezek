import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runCloseShiftsCron } from '@/lib/closeShiftsCronService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runCloseShiftsCronHttp(
    req: Request,
    cronSecret: string | undefined,
): Promise<NextResponse> {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const result = await runCloseShiftsCron({ supabase: getServiceClient() });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}
