import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runDataRetention } from '@/lib/dataRetentionCronService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runDataRetentionCronHttp(
    req: Request,
    cronSecret: string | undefined,
): Promise<NextResponse> {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const result = await runDataRetention({
        supabase: getServiceClient() as never,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}
