import { NextResponse } from 'next/server';

import { createSuccessResponse } from '@/lib/apiErrorHandler';
import { runTelegramMobileStartRoute } from '@/lib/telegramMobileStartRouteService';

export async function runTelegramMobileStartHttp(
    request: Request,
): Promise<NextResponse> {
    let body: {
        appName?: string;
        device?: string;
        region?: string;
        platform?: string;
    } = {};

    try {
        body = (await request.json()) as typeof body;
    } catch {
        body = {};
    }

    const result = await runTelegramMobileStartRoute({
        source: {
            appName: body.appName?.trim() || 'Kezek Mobile',
            device: body.device?.trim() || null,
            region: body.region?.trim() || null,
            platform: body.platform?.trim() || null,
            userAgent: request.headers.get('user-agent'),
        },
    });

    return createSuccessResponse(result.payload);
}
