import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getYandexCallbackUrl, getYandexOAuthCredentials } from '@/lib/yandexOAuthConfig';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const credentials = getYandexOAuthCredentials();
    if (!credentials) {
        return createErrorResponse('config', 'Вход через Яндекс временно недоступен', undefined, 503);
    }

    const state = randomUUID();
    const authUrl = new URL('https://oauth.yandex.ru/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', credentials.clientId);
    authUrl.searchParams.set('redirect_uri', getYandexCallbackUrl(request.url));
    authUrl.searchParams.set('state', state);

    const response = NextResponse.json({ ok: true, authUrl: authUrl.toString() });
    response.cookies.set('kezek_yandex_link_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60,
    });
    return response;
}
