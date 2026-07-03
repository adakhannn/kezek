import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logWarn } from '@/lib/log';
import { getRateLimitIdentifier } from '@/lib/rateLimit';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { checkWhatsAppMobileStartAbuse } from '@/lib/whatsAppMobileAbuseProtection';
import {
    buildWhatsAppMobileIdempotencyKey,
    readWhatsAppMobileIdempotency,
    writeWhatsAppMobileIdempotency,
} from '@/lib/whatsAppMobileAuthIdempotency';
import { runWhatsAppMobileStartRoute, type WhatsAppMobileStartRouteResult } from '@/lib/whatsAppMobileStartRouteService';

type StartBody = {
    phone?: string;
};

function validateReplayWindow(headers: Headers) {
    const tsHeader = headers.get('x-client-timestamp');
    if (!tsHeader) return { ok: true as const };

    const ts = Number(tsHeader);
    if (!Number.isFinite(ts)) {
        return { ok: false as const, message: 'Неверный x-client-timestamp' };
    }

    const delta = Math.abs(Date.now() - ts);
    if (delta > 5 * 60 * 1000) {
        return { ok: false as const, message: 'Запрос устарел. Повторите попытку.' };
    }

    return { ok: true as const };
}

export async function runWhatsAppMobileStartHttp(req: Request): Promise<NextResponse> {
    let body: StartBody = {};
    try {
        body = (await req.json()) as StartBody;
    } catch {
        return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
    }

    const normalizedPhone = body.phone ? normalizePhoneToE164(body.phone) : null;
    if (normalizedPhone) {
        const abuse = checkWhatsAppMobileStartAbuse({
            identifier: getRateLimitIdentifier(req),
            phone: normalizedPhone,
        });
        if (!abuse.ok) {
            return createErrorResponse(
                'rate_limit',
                `Слишком много попыток. Повторите через ${abuse.retryAfterSec} сек.`,
                { reason: abuse.reason, retryAfter: abuse.retryAfterSec },
                429,
            );
        }
    }

    const idempotencyHeader = req.headers.get('x-idempotency-key')?.trim();
    const replay = validateReplayWindow(req.headers);
    if (!replay.ok) {
        return createErrorResponse('validation', replay.message, undefined, 400);
    }
    const idempotencyKey = idempotencyHeader
        ? buildWhatsAppMobileIdempotencyKey(['whatsapp-mobile-start', body.phone ?? '', idempotencyHeader])
        : '';

    if (idempotencyKey) {
        const cached = readWhatsAppMobileIdempotency<WhatsAppMobileStartRouteResult>(idempotencyKey);
        if (cached?.ok) {
            return createSuccessResponse(cached.payload);
        }
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        logWarn('WhatsAppMobileStart', 'WhatsApp auth start unavailable because service role key is not configured');
        return createErrorResponse(
            'service_unavailable',
            'Вход через WhatsApp временно недоступен. Попробуйте другой способ входа или повторите позже.',
            undefined,
            503,
        );
    }

    const result = await runWhatsAppMobileStartRoute({
        admin: createSupabaseAdminClient() as unknown as Parameters<typeof runWhatsAppMobileStartRoute>[0]['admin'],
        phone: body.phone,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    if (idempotencyKey) {
        writeWhatsAppMobileIdempotency(idempotencyKey, result);
    }

    return createSuccessResponse(result.payload);
}
