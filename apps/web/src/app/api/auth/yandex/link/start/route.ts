import { NextResponse } from 'next/server';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getYandexCallbackUrl, getYandexOAuthCredentials } from '@/lib/yandexOAuthConfig';
import { createYandexOAuthState } from '@/lib/yandexOAuthState';

export const dynamic = 'force-dynamic';

async function startLink(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const credentials = getYandexOAuthCredentials();
    if (!credentials) {
        return createErrorResponse('config', 'Вход через Яндекс временно недоступен', undefined, 503);
    }

    let state: string;
    try {
        state = await createYandexOAuthState('link', user.id, '/profile');
    } catch {
        return createErrorResponse('service_unavailable', 'Вход через Яндекс временно недоступен', undefined, 503);
    }
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

export async function POST(request: Request) {
    return withRateLimit(request, { ...RateLimitConfigs.auth, keyPrefix: 'yandex-link-start' }, () => startLink(request), "/api/auth/yandex/link/start");
}
