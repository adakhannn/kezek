import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getRateLimitIdentifier } from '@/lib/rateLimit';
import {
    isNonceProbeBlocked,
    registerInvalidNonceProbe,
} from '@/lib/telegramMobileNonceProbeProtection';
import { runTelegramMobileStatusRoute } from '@/lib/telegramMobileStatusRouteService';

export async function runTelegramMobileStatusHttp(
    request: NextRequest,
): Promise<NextResponse> {
    const identifier = getRateLimitIdentifier(request);
    const blocked = isNonceProbeBlocked(identifier);
    if (blocked.blocked) {
        return createErrorResponse(
            'rate_limit',
            `Слишком много невалидных попыток nonce. Повторите через ${blocked.retryAfterSec} секунд.`,
            { retryAfter: blocked.retryAfterSec },
            429,
        );
    }

    const result = await runTelegramMobileStatusRoute({
        nonce: request.nextUrl.searchParams.get('nonce'),
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    if (result.payload.status === 'failed') {
        registerInvalidNonceProbe(identifier);
    }

    return createSuccessResponse(result.payload);
}
