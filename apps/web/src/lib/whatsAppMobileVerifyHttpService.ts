import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getRateLimitIdentifier } from '@/lib/rateLimit';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { checkWhatsAppMobileVerifyAbuse } from '@/lib/whatsAppMobileAbuseProtection';
import {
    buildWhatsAppMobileIdempotencyKey,
    readWhatsAppMobileIdempotency,
    writeWhatsAppMobileIdempotency,
} from '@/lib/whatsAppMobileAuthIdempotency';
import { runWhatsAppMobileVerifyRoute, type WhatsAppMobileVerifyRouteResult } from '@/lib/whatsAppMobileVerifyRouteService';

type VerifyBody = {
    attemptId?: string;
    code?: string;
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

export async function runWhatsAppMobileVerifyHttp(req: Request): Promise<NextResponse> {
    let body: VerifyBody = {};
    try {
        body = (await req.json()) as VerifyBody;
    } catch {
        return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
    }

    if (body.attemptId?.trim()) {
        const abuse = checkWhatsAppMobileVerifyAbuse({
            identifier: getRateLimitIdentifier(req),
            attemptId: body.attemptId.trim(),
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
        ? buildWhatsAppMobileIdempotencyKey([
              'whatsapp-mobile-verify',
              body.attemptId ?? '',
              body.code ?? '',
              idempotencyHeader,
          ])
        : '';

    if (idempotencyKey) {
        const cached = readWhatsAppMobileIdempotency<WhatsAppMobileVerifyRouteResult>(idempotencyKey);
        if (cached?.ok) {
            return createSuccessResponse(cached.payload);
        }
    }

    const result = await runWhatsAppMobileVerifyRoute({
        admin: createSupabaseAdminClient() as unknown as Parameters<typeof runWhatsAppMobileVerifyRoute>[0]['admin'],
        attemptId: body.attemptId,
        code: body.code,
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
