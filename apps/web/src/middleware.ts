import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { isInvalidRefreshTokenError, isSupabaseAuthCookie } from '@/lib/supabaseAuthRecovery';

function isAndroidUserAgent(userAgent: string | null) {
    return Boolean(userAgent && /Android/i.test(userAgent));
}

function toAndroidIntentUrl(deepLink: string) {
    try {
        const parsed = new URL(deepLink);
        if (parsed.protocol !== 'kezek:') {
            return null;
        }

        const path = `${parsed.host}${parsed.pathname}`;
        const query = parsed.search || '';
        const hash = parsed.hash || '';
        return `intent://${path}${query}${hash}#Intent;scheme=kezek;package=kg.kezek.app;end`;
    } catch {
        return null;
    }
}

function applySecurityHeaders(response: NextResponse) {
    response.headers.set('X-DNS-Prefetch-Control', 'on');
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    return response;
}

function clearInvalidSupabaseSession(req: NextRequest) {
    const staleCookieNames = req.cookies
        .getAll()
        .map(({ name }) => name)
        .filter(isSupabaseAuthCookie);

    staleCookieNames.forEach((name) => req.cookies.delete(name));

    const response = NextResponse.next({ request: req });
    staleCookieNames.forEach((name) => {
        response.cookies.set({ name, value: '', path: '/', maxAge: 0 });
    });
    return response;
}

export async function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname;
    const userAgent = req.headers.get('user-agent');

    if (pathname === '/auth/callback-mobile' && isAndroidUserAgent(userAgent)) {
        const redirectParam = req.nextUrl.searchParams.get('redirect');
        if (redirectParam && redirectParam.startsWith('kezek://')) {
            const deepLink = new URL(redirectParam);
            const passthroughParams = ['exchange_code', 'code', 'access_token', 'refresh_token', 'type'];
            for (const key of passthroughParams) {
                const value = req.nextUrl.searchParams.get(key);
                if (value) {
                    deepLink.searchParams.set(key, value);
                }
            }

            const intentUrl = toAndroidIntentUrl(deepLink.toString());
            if (intentUrl) {
                return NextResponse.redirect(intentUrl, 302);
            }
        }
    }

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/auth/post-signup') ||
        pathname.startsWith('/auth/sign-in') ||
        pathname.startsWith('/auth/whatsapp') ||
        pathname.startsWith('/auth/callback') ||
        pathname.startsWith('/auth/verify')
    ) {
        return NextResponse.next();
    }

    let response = NextResponse.next({ request: req });
    let supabase: ReturnType<typeof createServerClient>;

    try {
        supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
            cookies: {
                getAll() {
                    return req.cookies.getAll();
                },
                setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
                    cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
                    response = NextResponse.next({ request: req });
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        });
    } catch (error) {
        const { logWarn } = await import('@/lib/log');
        logWarn('middleware', 'Supabase runtime configuration is invalid', error);
        return applySecurityHeaders(response);
    }

    try {
        const { error } = await supabase.auth.getUser();
        if (error) {
            if (isInvalidRefreshTokenError(error)) {
                response = clearInvalidSupabaseSession(req);
            }
            return applySecurityHeaders(response);
        }
    } catch (error) {
        if (isInvalidRefreshTokenError(error)) {
            return applySecurityHeaders(clearInvalidSupabaseSession(req));
        }

        const { logWarn } = await import('@/lib/log');
        logWarn('middleware', 'Supabase user lookup failed', error);
    }

    return applySecurityHeaders(response);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
