import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { sanitizeAuthReturnPath } from '@/lib/authReturnUrl';
import { getYandexCallbackUrl, getYandexOAuthCredentials, getYandexPublicOrigin } from '@/lib/yandexOAuthConfig';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const credentials = getYandexOAuthCredentials();
    const redirect = sanitizeAuthReturnPath(requestUrl.searchParams.get('redirect'));

    if (!credentials) {
        return NextResponse.redirect(
            new URL('/auth/sign-in?error=yandex_unavailable', getYandexPublicOrigin(request.url)),
        );
    }

    const state = randomUUID();
    const authorizeUrl = new URL('https://oauth.yandex.ru/authorize');
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', credentials.clientId);
    authorizeUrl.searchParams.set('redirect_uri', getYandexCallbackUrl(request.url));
    authorizeUrl.searchParams.set('state', state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set('kezek_yandex_sign_in_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60,
    });
    response.cookies.set('kezek_yandex_return_path', redirect, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 10 * 60,
    });
    return response;
}
