import { NextResponse } from 'next/server';

import {
    createErrorResponse,
    createSuccessResponse,
} from '@/lib/apiErrorHandler';
import { runNotifyPing } from '@/lib/notifyPingService';

export async function runNotifyPingHttp(req: Request): Promise<NextResponse> {
    const { to, from } = await req.json();

    const result = await runNotifyPing({
        to,
        from,
        env: process.env,
    });

    if (!result.ok) {
        return createErrorResponse(
            result.error,
            result.message,
            result.details,
            result.status,
        );
    }

    return createSuccessResponse(result.payload);
}
