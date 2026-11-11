import crypto from 'crypto';

import { createClient } from '@supabase/supabase-js';

import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/env';
import { issueMobileSessionGrant, MOBILE_CODE_CHALLENGE_RE } from '@/lib/mobileExchangeService';
import { resolveTelegramIdentity } from '@/lib/telegramLoginService';
import {
    consumePendingTelegramMobileAuthAttempt,
    getTelegramMobileAuthAttempt,
    markTelegramMobileAuthAttemptApproved,
    markTelegramMobileAuthAttemptFailed,
} from '@/lib/telegramMobileAuthAttemptService';

type TelegramMobileConfirmBody = {
    nonce?: string;
    telegram_id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
};

type Failure = {
    ok: false;
    status: 400 | 401 | 404 | 409 | 410 | 500 | 503;
    error:
        | 'validation'
        | 'auth'
        | 'not_found'
        | 'conflict'
        | 'service_unavailable'
        | 'internal';
    message: string;
};

type Success = {
    ok: true;
    payload: {
        status: 'approved';
        nonce: string;
        expiresAt: number;
        linkage: 'existing' | 'created';
    };
};

export type TelegramMobileConfirmRouteResult = Failure | Success;

function getMobileBotSecret() {
    return process.env.TELEGRAM_MOBILE_BOT_SECRET?.trim() || '';
}

function safeEqual(a: string, b: string) {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    if (aBuffer.length !== bBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function buildFullName(firstName?: string, lastName?: string) {
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return fullName || null;
}

export async function runTelegramMobileConfirmRoute({
    body,
    botSecret,
}: {
    body: TelegramMobileConfirmBody;
    botSecret?: string | null;
}): Promise<TelegramMobileConfirmRouteResult> {
    const expectedSecret = getMobileBotSecret();
    if (!expectedSecret) {
        return {
            ok: false,
            status: 503,
            error: 'service_unavailable',
            message: 'Telegram mobile confirm временно недоступен',
        };
    }

    if (!botSecret || !safeEqual(expectedSecret, botSecret)) {
        return {
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Неверный секрет подтверждения',
        };
    }

    const nonce = body.nonce?.trim();
    const telegramId = body.telegram_id;
    if (!nonce || !telegramId || !Number.isInteger(telegramId) || telegramId <= 0) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать корректные nonce и telegram_id',
        };
    }

    const currentAttempt = await getTelegramMobileAuthAttempt(nonce);
    if (currentAttempt?.status === 'approved') {
        if (currentAttempt.telegramId && currentAttempt.telegramId !== telegramId) {
            return {
                ok: false,
                status: 409,
                error: 'conflict',
                message: 'Попытка входа подтверждается из другого Telegram аккаунта',
            };
        }

        return {
            ok: true,
            payload: {
                status: 'approved',
                nonce,
                expiresAt: currentAttempt.expiresAt,
                linkage: currentAttempt.linkage ?? 'existing',
            },
        };
    }
    if (currentAttempt?.status === 'expired') {
        return {
            ok: false,
            status: 410,
            error: 'conflict',
            message: 'Попытка входа истекла',
        };
    }

    const pending = await consumePendingTelegramMobileAuthAttempt(nonce);
    if (!pending.ok) {
        if (pending.error === 'not_found') {
            return {
                ok: false,
                status: 404,
                error: 'not_found',
                message: 'Попытка входа не найдена',
            };
        }

        if (pending.error === 'expired') {
            return {
                ok: false,
                status: 410,
                error: 'conflict',
                message: 'Попытка входа истекла',
            };
        }

        return {
            ok: false,
            status: 409,
            error: 'conflict',
            message: 'Попытка входа уже обработана',
        };
    }

    if (
        pending.attempt.expectedTelegramId &&
        pending.attempt.expectedTelegramId !== telegramId
    ) {
        await markTelegramMobileAuthAttemptFailed({
            nonce,
            reason: 'telegram_identity_mismatch',
        });
        return {
            ok: false,
            status: 409,
            error: 'conflict',
            message: 'Попытка входа подтверждается из другого Telegram аккаунта',
        };
    }

    if (!pending.attempt.codeChallenge || !MOBILE_CODE_CHALLENGE_RE.test(pending.attempt.codeChallenge)) {
        await markTelegramMobileAuthAttemptFailed({ nonce, reason: 'missing_initiator_binding' });
        return { ok: false, status: 409, error: 'conflict', message: 'Начните вход заново в обновлённом приложении.' };
    }

    const serviceRoleKey = getSupabaseServiceRoleKey();
    const supabaseUrl = getSupabaseUrl();
    const admin = createClient(supabaseUrl, serviceRoleKey) as unknown as Parameters<
        typeof resolveTelegramIdentity
    >[0]['admin'];

    const loginResult = await resolveTelegramIdentity({
        admin,
        normalized: {
            telegram_id: telegramId,
            full_name: buildFullName(body.first_name, body.last_name),
            telegram_username: body.username || null,
            telegram_photo_url: body.photo_url || null,
        },
    });

    if (!loginResult.ok) {
        await markTelegramMobileAuthAttemptFailed({
            nonce,
            reason: 'telegram_login_failed',
        });
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: loginResult.message,
        };
    }

    const { code } = await issueMobileSessionGrant({
        userId: loginResult.userId,
        codeChallenge: pending.attempt.codeChallenge!,
    });

    await markTelegramMobileAuthAttemptApproved({
        nonce,
        telegramId,
        userId: loginResult.userId,
        exchangeCode: code,
        linkage: loginResult.linkage,
    });

    return {
        ok: true,
        payload: {
            status: 'approved',
            nonce,
            expiresAt: pending.attempt.expiresAt,
            linkage: loginResult.linkage,
        },
    };
}

