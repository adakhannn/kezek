import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { runYandexAuthCallbackRoute } from '@/lib/yandexAuthCallbackRouteService';

export async function runYandexAuthCallbackHttp(req: Request): Promise<NextResponse> {
    const requestUrl = new URL(req.url);
    const state = requestUrl.searchParams.get('state');
    let linkUserId: string | undefined;

    if (state) {
        const cookieStore = await cookies();
        const expectedState = cookieStore.get('kezek_yandex_link_state')?.value;
        if (!expectedState || expectedState !== state) {
            return NextResponse.redirect(new URL('/cabinet/profile?error=yandex_link_state', requestUrl.origin));
        }

        const supabase = await createSupabaseServerClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.redirect(new URL('/auth/sign-in?error=session_required', requestUrl.origin));
        }
        linkUserId = user.id;
    }

    const result = await runYandexAuthCallbackRoute({
        requestUrl: req.url,
        env: process.env,
        linkUserId,
    });

    const response = NextResponse.redirect(result.redirectUrl);
    if (state) {
        response.cookies.set('kezek_yandex_link_state', '', { path: '/', maxAge: 0 });
    }
    return response;
}
