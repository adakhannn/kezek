import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

export async function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname;
    
    // Пропускаем проверку для статических файлов, API routes и страниц авторизации
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
    
    // Добавляем Security Headers (дополнительно к headers() в next.config.ts)
    // Это гарантирует, что headers применяются даже для динамических routes
    res.headers.set('X-DNS-Prefetch-Control', 'on');
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.headers.set('X-Frame-Options', 'SAMEORIGIN');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-XSS-Protection', '1; mode=block');
    res.headers.set('Referrer-Policy', 'origin-when-cross-origin');
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    const supabase = createServerClient(
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

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return res;

    // Ролевые редиректы включаем ТОЛЬКО для главной страницы ('/').
    // Это исключает циклы вида /dashboard -> /dashboard и /staff -> /staff.
    if (pathname === '/') {
        const { data: roles, error } = await supabase.rpc('my_role_keys');
        if (error) {
            // Логируем ошибку, но не прерываем запрос - пользователь останется на текущей странице
            const { logWarn } = await import('@/lib/log');
            logWarn('middleware', 'Failed to get user roles', error);
            return res;
        }

        const keys = Array.isArray(roles) ? (roles as string[]) : [];
        if (keys.includes('super_admin')) {
            const url = req.nextUrl.clone();
            url.pathname = '/admin';
            return NextResponse.redirect(url, 302);
        }
        // Владельцы, админы и менеджеры → либо выбор бизнеса, либо dashboard
        if (keys.includes('owner') || keys.some(k => ['admin', 'manager'].includes(k))) {
            try {
                // Если уже есть выбранный текущий бизнес — идём сразу в /dashboard
                const { data: current } = await supabase
                    .from('user_current_business')
                    .select('biz_id')
                    .eq('user_id', userRes.user.id)
                    .maybeSingle<{ biz_id: string }>();

                if (!current?.biz_id) {
                    // Нет current_biz_id — считаем доступные бизнесы
                    const ALLOWED_ROLE_KEYS = new Set(['owner', 'admin', 'manager']);

                    const [{ data: ownedBusinesses }, { data: roleBusinesses }] = await Promise.all([
                        supabase
                            .from('businesses')
                            .select('id')
                            .eq('owner_id', userRes.user.id),
                        supabase
                            .from('user_roles')
                            .select('biz_id, roles:key!inner(key)')
                            .eq('user_id', userRes.user.id)
                            .not('biz_id', 'is', null),
                    ]);

                    const bizIds = new Set<string>();

                    (ownedBusinesses ?? []).forEach((b: { id: string }) => {
                        if (b?.id) bizIds.add(b.id);
                    });

                    const roleBizRows = (roleBusinesses ?? []) as Array<{
                        biz_id: string | null;
                        roles: { key: string }[] | null;
                    }>;

                    roleBizRows.forEach((r) => {
                        if (!r.biz_id) return;
                        const roleKey = r.roles?.[0]?.key;
                        if (!roleKey || !ALLOWED_ROLE_KEYS.has(roleKey)) return;
                        bizIds.add(r.biz_id);
                    });

                    if (bizIds.size > 1) {
                        const url = req.nextUrl.clone();
                        url.pathname = '/select-business';
                        return NextResponse.redirect(url, 302);
                    }
                }

                const url = req.nextUrl.clone();
                url.pathname = '/dashboard';
                return NextResponse.redirect(url, 302);
            } catch {
                // В случае ошибок фоллбек на старое поведение
                const url = req.nextUrl.clone();
                url.pathname = '/dashboard';
                return NextResponse.redirect(url, 302);
            }
        }
        
        // Сотрудники → проверяем наличие записи в staff (источник правды)
        const { data: staff } = await supabase
            .from('staff')
            .select('id')
            .eq('user_id', userRes.user.id)
            .eq('is_active', true)
            .maybeSingle();
        
        if (staff) {
            const url = req.nextUrl.clone();
            url.pathname = '/staff';
            return NextResponse.redirect(url, 302);
        }
        
        // Fallback: проверяем роль через RPC
        if (keys.includes('staff')) {
            const url = req.nextUrl.clone();
            url.pathname = '/staff';
            return NextResponse.redirect(url, 302);
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
