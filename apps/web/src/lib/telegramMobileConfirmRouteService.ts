import crypto from 'crypto';

import { createClient } from '@supabase/supabase-js';

import { getSupabaseAnonKey, getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/env';
import { runMobileExchangePost } from '@/lib/mobileExchangeRouteService';
import { handleTelegramLogin } from '@/lib/telegramLoginService';
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

    const currentAttempt = getTelegramMobileAuthAttempt(nonce);
    if (currentAttempt?.status === 'approved') {
        if (currentAttempt.telegramId && currentAttempt.telegramId !== telegramId) {
            return {
                ok: false,
                status: 409,
                error: 'conflict',
                message: 'РџРѕРїС‹С‚РєР° РІС…РѕРґР° РїРѕРґС‚РІРµСЂР¶РґР°РµС‚СЃСЏ РёР· РґСЂСѓРіРѕРіРѕ Telegram Р°РєРєР°СѓРЅС‚Р°',
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
            message: 'РџРѕРїС‹С‚РєР° РІС…РѕРґР° РёСЃС‚РµРєР»Р°',
        };
    }

    const pending = consumePendingTelegramMobileAuthAttempt(nonce);
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
        markTelegramMobileAuthAttemptFailed({
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

    const serviceRoleKey = getSupabaseServiceRoleKey();
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    const admin = createClient(supabaseUrl, serviceRoleKey) as unknown as Parameters<
        typeof handleTelegramLogin
    >[0]['admin'];
    const authClient = createClient(supabaseUrl, anonKey);

    const loginResult = await handleTelegramLogin({
        admin,
        normalized: {
            telegram_id: telegramId,
            full_name: buildFullName(body.first_name, body.last_name),
            telegram_username: body.username || null,
            telegram_photo_url: body.photo_url || null,
        },
    });

    if (!loginResult.ok) {
        markTelegramMobileAuthAttemptFailed({
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

    const { error: signInError, data: signInData } =
        await authClient.auth.signInWithPassword({
            email: loginResult.data.email,
            password: loginResult.data.password,
        });

    const accessToken = signInData.session?.access_token;
    const refreshToken = signInData.session?.refresh_token;

    if (signInError || !accessToken || !refreshToken) {
        markTelegramMobileAuthAttemptFailed({
            nonce,
            reason: 'supabase_sign_in_failed',
        });
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Не удалось подготовить мобильную сессию',
        };
    }

    const exchangeResult = runMobileExchangePost({
        accessToken,
        refreshToken,
    });

    if (!exchangeResult.ok) {
        markTelegramMobileAuthAttemptFailed({
            nonce,
            reason: 'mobile_exchange_prepare_failed',
        });
        return {
            ok: false,
            status: 500,
            error: 'internal',
            message: 'Не удалось подготовить exchange-код для мобильной сессии',
        };
    }

    const code = exchangeResult.payload.code;

    markTelegramMobileAuthAttemptApproved({
        nonce,
        telegramId,
        userId: loginResult.data.userId,
        exchangeCode: code,
        linkage: loginResult.data.linkage,
    });

    return {
        ok: true,
        payload: {
            status: 'approved',
            nonce,
            expiresAt: pending.attempt.expiresAt,
            linkage: loginResult.data.linkage,
        },
    };
}
