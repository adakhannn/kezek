import type { Browser, Page, StorageState } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';

import { getBaseUrl, readRequiredEnv } from './testEnv';

/**
 * Programmatic sign-in for e2e.
 *
 * The sign-in page offers only social providers (Google, Yandex, Telegram, WhatsApp), so the specs
 * sign in with the e-mail/password of the accounts that `scripts/e2e-seed.mjs` creates in the LOCAL
 * GoTrue. The session is obtained with the same `@supabase/ssr` server client the app uses, so the
 * cookies (name, chunking, base64 encoding) are exactly the ones the middleware and server
 * components read; they are added to the Playwright context for the base URL.
 */

type Cookie = StorageState['cookies'][number];

type EmailSignInOptions = {
    /** Kept for existing callers; programmatic sign-in does not wait. */
    waitAfterSubmitMs?: number;
    /** Kept for existing callers; there is no e-mail field to expect. */
    expectEmailField?: boolean;
};

type PasswordSignInOptions = {
    /** Kept for existing callers; the caller navigates after sign-in. */
    successUrlPattern?: RegExp;
};

/** `sb-<ref>-auth-token`, derived from the URL the app is configured with. */
function authCookieName(appSupabaseUrl: string): string {
    return `sb-${new URL(appSupabaseUrl).hostname.split('.')[0]}-auth-token`;
}

/**
 * Signs in against GoTrue and returns the auth cookies for the base URL.
 * E2E_SUPABASE_AUTH_URL lets a runner that cannot reach NEXT_PUBLIC_SUPABASE_URL (for example a
 * Playwright Docker container) use another address of the same local stack.
 */
export async function createSessionCookies(email: string, password?: string): Promise<Cookie[]> {
    const appSupabaseUrl = readRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey = readRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    const authUrl = process.env.E2E_SUPABASE_AUTH_URL || appSupabaseUrl;
    const secret = password ?? readRequiredEnv('E2E_TEST_PASSWORD');

    const jar = new Map<string, string>();
    const supabase = createServerClient(authUrl, anonKey, {
        cookieOptions: { name: authCookieName(appSupabaseUrl) },
        cookies: {
            getAll: () => [...jar].map(([name, value]) => ({ name, value })),
            setAll: (cookies) => {
                for (const { name, value } of cookies) {
                    if (value) jar.set(name, value);
                    else jar.delete(name);
                }
            },
        },
    });

    const { error } = await supabase.auth.signInWithPassword({ email, password: secret });
    if (error) throw new Error(`E2E sign-in failed for ${email}: ${error.message}`);
    if (jar.size === 0) throw new Error(`E2E sign-in for ${email} produced no session cookies`);

    const base = new URL(getBaseUrl());
    const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
    return [...jar].map(([name, value]) => ({
        name,
        value,
        domain: base.hostname,
        path: '/',
        expires,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
    }));
}

/** Signs the page's context in as the seeded account with this e-mail. */
export async function signInWithEmailSeed(
    page: Page,
    email: string,
    _options: EmailSignInOptions = {},
): Promise<void> {
    await page.context().addCookies(await createSessionCookies(email));
}

/** A storage state holding the session of the seeded account with this e-mail. */
export async function createStorageStateForEmailSeed(
    _browser: Browser,
    email: string,
    _options: EmailSignInOptions = {},
): Promise<StorageState> {
    return { cookies: await createSessionCookies(email), origins: [] };
}

export async function applyStorageStateCookies(
    page: Page,
    storageState: StorageState | null | undefined,
): Promise<void> {
    if (storageState?.cookies?.length) {
        await page.context().addCookies(storageState.cookies);
    }
}

export async function signInWithPassword(
    page: Page,
    email: string,
    password: string,
    _options: PasswordSignInOptions = {},
): Promise<void> {
    await page.context().addCookies(await createSessionCookies(email, password));
}
