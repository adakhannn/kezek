import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { runYandexAuthCallbackRoute } from '@/lib/yandexAuthCallbackRouteService';
import { getYandexPublicOrigin } from '@/lib/yandexOAuthConfig';

export async function runYandexAuthCallbackHttp(req: Request): Promise<NextResponse> {
    const requestUrl = new URL(req.url);
    const publicOrigin = getYandexPublicOrigin(req.url);
    const state = requestUrl.searchParams.get('state');
    let linkUserId: string | undefined;
    let isSignInFlow = false;

    if (state) {
        const cookieStore = await cookies();
        const expectedState = cookieStore.get('kezek_yandex_link_state')?.value;
        if (expectedState === state) {
            const supabase = await createSupabaseServerClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                return NextResponse.redirect(new URL('/auth/sign-in?error=session_required', publicOrigin));
            }
            linkUserId = user.id;
        } else {
            const expectedSignInState = cookieStore.get('kezek_yandex_sign_in_state')?.value;
            if (!expectedSignInState || expectedSignInState !== state) {
                return NextResponse.redirect(new URL('/auth/sign-in?error=yandex_state', publicOrigin));
            }
            isSignInFlow = true;
        }
    }

    if (isSignInFlow) {
        const cookieStore = await cookies();
        const redirectFromCookie = cookieStore.get('kezek_yandex_return_path')?.value;
        if (redirectFromCookie) {
            requestUrl.searchParams.set('redirect', redirectFromCookie);
        }
    }

    const result = await runYandexAuthCallbackRoute({
        requestUrl: requestUrl.toString(),
        env: process.env,
        linkUserId,
    });

    const response = NextResponse.redirect(result.redirectUrl);
    if (state) {
        response.cookies.set('kezek_yandex_link_state', '', { path: '/', maxAge: 0 });
        response.cookies.set('kezek_yandex_sign_in_state', '', { path: '/', maxAge: 0 });
        response.cookies.set('kezek_yandex_return_path', '', { path: '/', maxAge: 0 });
    }
    return response;
}
