import { createClient } from '@supabase/supabase-js';

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

export async function runYandexAuthCallbackRoute({
    requestUrl,
    env,
    fetchImpl = fetch,
}: {
    requestUrl: string;
    env: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
}): Promise<YandexAuthCallbackRouteResult> {
    const { searchParams } = new URL(requestUrl);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const redirectTo = searchParams.get('redirect') || '/';

    const origin = env.NEXT_PUBLIC_SITE_ORIGIN || 'https://kezek.kg';
    const redirectUri = `${origin}/auth/callback-yandex`;

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
        throw new Error('Failed to exchange code for token');
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
        throw new Error('No access token received');
    }

    const userResponse = await fetchImpl('https://login.yandex.ru/info', {
        headers: {
            Authorization: `OAuth ${tokenData.access_token}`,
        },
    });

    if (!userResponse.ok) {
        throw new Error('Failed to get user info');
    }

    const yandexUser = (await userResponse.json()) as YandexUserInfo;
    const admin = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
    ) as unknown as YandexAuthAdminClientLike;

    const result = await runYandexOAuthCallback({
        admin,
        yandexUser,
        origin,
        redirectTo,
    });

    return {
        ok: true,
        redirectUrl: result.redirectUrl,
    };
}
