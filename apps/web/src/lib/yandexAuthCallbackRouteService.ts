import { createClient } from '@supabase/supabase-js';

import { logWarn } from '@/lib/log';
import { runYandexOAuthCallback } from '@/lib/yandexAuthCallbackService';
import type {
    YandexAuthAdminClientLike,
    YandexUserInfo,
} from '@/lib/yandexAuthCallbackService';

type Failure = {
    ok: false;
    redirectUrl: string;
};

type Success = {
    ok: true;
    redirectUrl: string;
};

export type YandexAuthCallbackRouteResult = Failure | Success;

function buildAuthFailureRedirect(origin: string, code: string): YandexAuthCallbackRouteResult {
    return {
        ok: false,
        redirectUrl: `${origin}/auth/sign-in?error=${encodeURIComponent(code)}`,
    };
}

export async function runYandexAuthCallbackRoute({
    requestUrl,
    env,
    fetchImpl = fetch,
    linkUserId,
}: {
    requestUrl: string;
    env: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    linkUserId?: string;
}): Promise<YandexAuthCallbackRouteResult> {
    const { searchParams } = new URL(requestUrl);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const redirectTo = searchParams.get('redirect') || '/';

    const origin = env.NEXT_PUBLIC_SITE_ORIGIN || 'https://kezek.kg';
    const redirectUri =
        env.NEXT_PUBLIC_YANDEX_REDIRECT_URI ||
        'https://kezek.kg/auth/callback-yandex';

    if (error) {
        return {
            ok: false,
            redirectUrl: `${origin}/auth/sign-in?error=${encodeURIComponent(error)}`,
        };
    }

    if (!code) {
        return {
            ok: false,
            redirectUrl: `${origin}/auth/sign-in?error=no_code`,
        };
    }

    let yandexUser: YandexUserInfo;
    try {
        const tokenResponse = await fetchImpl('https://oauth.yandex.ru/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: env.YANDEX_OAUTH_CLIENT_ID!,
                client_secret: env.YANDEX_OAUTH_CLIENT_SECRET!,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            logWarn('YandexAuth', 'Token exchange failed', { status: tokenResponse.status });
            return buildAuthFailureRedirect(origin, 'yandex_exchange_failed');
        }

        const tokenData = (await tokenResponse.json()) as { access_token?: string };
        if (!tokenData.access_token) {
            logWarn('YandexAuth', 'Token exchange returned no access token');
            return buildAuthFailureRedirect(origin, 'yandex_exchange_failed');
        }

        const userResponse = await fetchImpl('https://login.yandex.ru/info', {
            headers: {
                Authorization: `OAuth ${tokenData.access_token}`,
            },
        });

        if (!userResponse.ok) {
            logWarn('YandexAuth', 'User info request failed', { status: userResponse.status });
            return buildAuthFailureRedirect(origin, 'yandex_profile_failed');
        }

        yandexUser = (await userResponse.json()) as YandexUserInfo;
    } catch (error) {
        logWarn('YandexAuth', 'OAuth callback request failed', error);
        return buildAuthFailureRedirect(origin, 'yandex_exchange_failed');
    }
    const admin = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
    ) as unknown as YandexAuthAdminClientLike;

    const result = await runYandexOAuthCallback({
        admin,
        yandexUser,
        origin,
        redirectTo,
        linkUserId,
    });

    return {
        ok: true,
        redirectUrl: result.redirectUrl,
    };
}
