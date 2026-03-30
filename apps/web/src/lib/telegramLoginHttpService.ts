import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runTelegramLoginRoute } from '@/lib/telegramLoginRouteService';
import type { TelegramAuthData } from '@/lib/telegram/verify';

export async function runTelegramLoginHttp(req: Request): Promise<NextResponse> {
    const body = (await req.json()) as TelegramAuthData;
    const result = await runTelegramLoginRoute(body);

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.payload);
}
