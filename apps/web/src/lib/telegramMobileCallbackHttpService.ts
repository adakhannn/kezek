import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getRateLimitIdentifier } from '@/lib/rateLimit';
import { verifyTelegramMobileBotRequestAuth } from '@/lib/telegramMobileBotRequestAuth';
import { runTelegramMobileCallbackRoute } from '@/lib/telegramMobileCallbackRouteService';
import {
    isNonceProbeBlocked,
    registerInvalidNonceProbe,
} from '@/lib/telegramMobileNonceProbeProtection';

function getMobileBotSecret() {
    return process.env.TELEGRAM_MOBILE_BOT_SECRET?.trim() || '';
}

export async function runTelegramMobileCallbackHttp(request: Request): Promise<NextResponse> {
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

    const bodyRaw = await request.text();
    const auth = verifyTelegramMobileBotRequestAuth({
        expectedSecret: getMobileBotSecret(),
        botSecret: request.headers.get('x-telegram-bot-secret'),
        timestampHeader: request.headers.get('x-telegram-bot-timestamp'),
        requestIdHeader: request.headers.get('x-telegram-bot-request-id'),
        signatureHeader: request.headers.get('x-telegram-bot-signature'),
        bodyRaw,
    });
    if (!auth.ok) {
        return createErrorResponse(auth.error, auth.message, undefined, auth.status);
    }

    const body = JSON.parse(bodyRaw || '{}') as {
        nonce?: string;
        telegram_id?: number;
        decision?: string;
        first_name?: string;
        last_name?: string;
        username?: string;
        photo_url?: string;
    };

    const result = await runTelegramMobileCallbackRoute({
        body,
        botSecret: request.headers.get('x-telegram-bot-secret'),
    });

    if (!result.ok) {
        if (result.error === 'not_found') {
            registerInvalidNonceProbe(identifier);
        }
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.payload);
}
