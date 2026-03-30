import { createClient } from '@supabase/supabase-js';

import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/env';
import { handleTelegramLogin } from '@/lib/telegramLoginService';
import {
    normalizeTelegramData,
    verifyTelegramAuth,
    type TelegramAuthData,
} from '@/lib/telegram/verify';

type Failure = {
    ok: false;
    status: 400 | 503 | 500;
    error: 'validation' | 'service_unavailable' | 'internal';
    message: string;
    details?: Record<string, unknown>;
};

type Success = {
    ok: true;
    payload: {
        userId: string;
        email: string;
        password: string;
        needsSignIn: true;
        redirect: '/';
    };
};

export type TelegramLoginRouteResult = Failure | Success;

export async function runTelegramLoginRoute(
    body: TelegramAuthData,
): Promise<TelegramLoginRouteResult> {
    let serviceKey: string;

    try {
        serviceKey = getSupabaseServiceRoleKey();
    } catch {
        return {
            ok: false,
            status: 503,
            error: 'service_unavailable',
            message: 'Вход через Telegram временно недоступен. Обратитесь к администратору сайта.',
            details: { code: 'service_key_missing' },
        };
    }

    if (!body || !body.id || !body.hash || !body.auth_date) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Недостаточно данных от Telegram',
            details: { code: 'missing_data' },
        };
    }

    if (!verifyTelegramAuth(body)) {
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Неверная подпись данных Telegram',
            details: { code: 'invalid_signature' },
        };
    }

    const admin = createClient(
        getSupabaseUrl(),
        serviceKey,
    ) as Parameters<typeof handleTelegramLogin>[0]['admin'];
    const normalized = normalizeTelegramData(body);
    const result = await handleTelegramLogin({
        admin,
        normalized,
    });

    if (!result.ok) {
        return {
            ok: false,
            status: result.status as 500,
            error: result.error as 'internal',
            message: result.message,
            details: result.details as Record<string, unknown> | undefined,
        };
    }

    return {
        ok: true,
        payload: result.data,
    };
}
