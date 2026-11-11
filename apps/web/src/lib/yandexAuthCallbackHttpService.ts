import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { runYandexAuthCallbackRoute } from '@/lib/yandexAuthCallbackRouteService';
import { getYandexPublicOrigin } from '@/lib/yandexOAuthConfig';
import { consumeYandexOAuthState } from '@/lib/yandexOAuthState';

function clearStateCookies(response: NextResponse) {
    for (const name of ['kezek_yandex_link_state', 'kezek_yandex_sign_in_state', 'kezek_yandex_return_path']) {
        response.cookies.set(name, '', { path: '/', maxAge: 0 });
    }
    return response;
}

export async function runYandexAuthCallbackHttp(req: Request): Promise<NextResponse> {
    const requestUrl = new URL(req.url);
    const publicOrigin = getYandexPublicOrigin(req.url);
    const state = requestUrl.searchParams.get('state');
    let linkUserId: string | undefined;
    const reject = (error: string) => clearStateCookies(
        NextResponse.redirect(new URL(`/auth/sign-in?error=${error}`, publicOrigin)),
    );
    if (!state || !/^[a-f0-9]{64}$/.test(state)) return reject('yandex_state');

    try {
        const cookieStore = await cookies();
        let flow: 'link' | 'sign_in';
        if (cookieStore.get('kezek_yandex_link_state')?.value === state) {
            flow = 'link';
            const supabase = await createSupabaseServerClient();
            const {
                data: { user },
                error,
            } = await supabase.auth.getUser();
            if (error || !user) return reject('session_required');
            linkUserId = user.id;
        } else if (cookieStore.get('kezek_yandex_sign_in_state')?.value === state) {
            flow = 'sign_in';
        } else {
            return reject('yandex_state');
        }
        const attempt = await consumeYandexOAuthState(state, flow, linkUserId ?? null);
        if (!attempt) return reject('yandex_state');
        requestUrl.searchParams.set('redirect', attempt.returnPath);
        const result = await runYandexAuthCallbackRoute({
            requestUrl: requestUrl.toString(),
            env: process.env,
            linkUserId,
        });
        return clearStateCookies(NextResponse.redirect(result.redirectUrl));
    } catch {
        return reject('yandex_unavailable');
    }
}
