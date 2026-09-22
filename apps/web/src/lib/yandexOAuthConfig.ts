import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getLocalAuthPublicOrigin } from '@/lib/localAuthPublicOrigin';

type OAuthEnv = Record<string, string | undefined>;

type YandexOAuthCredentials = {
    clientId: string;
    clientSecret: string;
};

/**
 * The web app is run from apps/web, while local developer secrets live in the
 * workspace .env.local. Vercel supplies these values through process.env, so
 * the file fallback is only relevant for local development.
 */
function getWorkspaceEnvValue(name: string): string {
    if (process.env.NODE_ENV === 'production') return '';

    const workspaceEnvPath = resolve(process.cwd(), '../../.env.local');
    if (!existsSync(workspaceEnvPath)) return '';

    const line = readFileSync(workspaceEnvPath, 'utf8')
        .split(/\r?\n/)
        .find((candidate) => candidate.startsWith(`${name}=`));

    return line ? line.slice(name.length + 1).trim().replace(/^['"]|['"]$/g, '') : '';
}

function getEnvValue(name: string, env: OAuthEnv): string {
    return env[name]?.trim() || getWorkspaceEnvValue(name);
}

export function getYandexOAuthCredentials(env: OAuthEnv = process.env): YandexOAuthCredentials | null {
    const clientId =
        getEnvValue('YANDEX_OAUTH_CLIENT_ID', env) ||
        getEnvValue('NEXT_PUBLIC_YANDEX_CLIENT_ID', env);
    const clientSecret = getEnvValue('YANDEX_OAUTH_CLIENT_SECRET', env);

    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
}

export function getYandexPublicOrigin(requestUrl: string, env: OAuthEnv = process.env): string {
    return getLocalAuthPublicOrigin(requestUrl, env);
}

export function getYandexCallbackUrl(requestUrl: string, env: OAuthEnv = process.env): string {
    return new URL('/auth/callback-yandex', getYandexPublicOrigin(requestUrl, env)).toString();
}
