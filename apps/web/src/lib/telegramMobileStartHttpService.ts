import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { MOBILE_CODE_CHALLENGE_RE } from '@/lib/mobileExchangeService';
import { runTelegramMobileStartRoute } from '@/lib/telegramMobileStartRouteService';

export async function runTelegramMobileStartHttp(
    request: Request,
): Promise<NextResponse> {
    let body: {
        appName?: string;
        device?: string;
        region?: string;
        platform?: string;
        codeChallenge?: string;
    } = {};

    try {
        body = (await request.json()) as typeof body;
    } catch {
        body = {};
    }

    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.codeChallenge !== 'string' || !MOBILE_CODE_CHALLENGE_RE.test(body.codeChallenge)) {
        return createErrorResponse('validation', 'Обновите приложение и начните вход заново.', undefined, 400);
    }
    const result = await runTelegramMobileStartRoute({
        codeChallenge: body.codeChallenge,
        source: {
            appName: (typeof body.appName === 'string' ? body.appName.trim().slice(0, 120) : '') || 'Kezek Mobile',
            device: (typeof body.device === 'string' ? body.device.trim().slice(0, 120) : '') || null,
            region: (typeof body.region === 'string' ? body.region.trim().slice(0, 120) : '') || null,
            platform: (typeof body.platform === 'string' ? body.platform.trim().slice(0, 120) : '') || null,
            userAgent: request.headers.get('user-agent'),
        },
    });

    return createSuccessResponse(result.payload);
}
