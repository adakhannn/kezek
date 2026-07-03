import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
    countAvailableCabinetTypes,
    getPathForPreferredCabinet,
    getUserRoleProfile,
    PREFERRED_CABINET_COOKIE_NAME,
    resolveDefaultDashboard,
    shouldRedirectToSelectBusiness,
} from '@/lib/authContext';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

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

    const res = NextResponse.next();

    res.headers.set('X-DNS-Prefetch-Control', 'on');
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.headers.set('X-Frame-Options', 'SAMEORIGIN');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-XSS-Protection', '1; mode=block');
    res.headers.set('Referrer-Policy', 'origin-when-cross-origin');
    // geolocation=(self) — для страницы карты «Ближайший ко мне»
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');

    let supabase: ReturnType<typeof createServerClient>;
    try {
        supabase = createServerClient(
            getSupabaseUrl(),
            getSupabaseAnonKey(),
            {
                cookies: {
                    get: (name: string) => req.cookies.get(name)?.value,
                    set: (name: string, value: string, options?: { path?: string; domain?: string; maxAge?: number; expires?: Date; httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none' | boolean }) => {
                        res.cookies.set({ name, value, ...options });
                    },
                    remove: (name: string, options?: { path?: string; domain?: string }) => {
                        res.cookies.set({ name, value: '', ...options });
                    },
                },
            }
        );
    } catch (e) {
        const { logWarn } = await import('@/lib/log');
        logWarn('middleware', 'Supabase runtime configuration is invalid', e);
        return res;
    }

    let userRes: { user: unknown };
    try {
        const authResult = await supabase.auth.getUser();
        userRes = authResult.data;
    } catch (e) {
        const { logWarn } = await import('@/lib/log');
        logWarn('middleware', 'Supabase user lookup failed', e);
        return res;
    }
    if (!userRes.user) return res;

    if (pathname === '/') {
        try {
            const profile = await getUserRoleProfile(supabase);
            if (!profile) return res;

            const cabinetCount = countAvailableCabinetTypes(profile);

            if (cabinetCount >= 2) {
                const preferred = req.cookies.get(PREFERRED_CABINET_COOKIE_NAME)?.value;
                const path = getPathForPreferredCabinet(profile, preferred);
                if (path) {
                    if (path === '/dashboard') {
                        const { data: current } = await supabase
                            .from('user_current_business')
                            .select('biz_id')
                            .eq('user_id', profile.userId)
                            .maybeSingle<{ biz_id: string }>();
                        if (shouldRedirectToSelectBusiness(profile, !!current?.biz_id)) {
                            const url = req.nextUrl.clone();
                            url.pathname = '/select-business';
                            return NextResponse.redirect(url, 302);
                        }
                    }
                    const url = req.nextUrl.clone();
                    url.pathname = path;
                    return NextResponse.redirect(url, 302);
                }
                const url = req.nextUrl.clone();
                url.pathname = '/select-cabinet';
                return NextResponse.redirect(url, 302);
            }

            const result = resolveDefaultDashboard(profile);
            if (result.path === '/dashboard') {
                const { data: current } = await supabase
                    .from('user_current_business')
                    .select('biz_id')
                    .eq('user_id', profile.userId)
                    .maybeSingle<{ biz_id: string }>();

                if (shouldRedirectToSelectBusiness(profile, !!current?.biz_id)) {
                    const url = req.nextUrl.clone();
                    url.pathname = '/select-business';
                    return NextResponse.redirect(url, 302);
                }
            }

            const url = req.nextUrl.clone();
            url.pathname = result.path;
            return NextResponse.redirect(url, 302);
        } catch (e) {
            const { logWarn } = await import('@/lib/log');
            logWarn('middleware', 'Redirect from / failed', e);
            return res;
        }
    }

    return res;
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
