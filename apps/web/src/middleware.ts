import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname;
    
    // Пропускаем проверку для статических файлов, API routes и страниц авторизации
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/auth/post-signup') ||
        pathname.startsWith('/auth/sign-in') ||
        pathname.startsWith('/auth/sign-up') ||
        pathname.startsWith('/auth/whatsapp') ||
        pathname.startsWith('/auth/callback') ||
        pathname.startsWith('/auth/verify')
    ) {
        return NextResponse.next();
    }

    const res = NextResponse.next();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (name: string) => req.cookies.get(name)?.value,
                set: (name: string, value: string, options) => {
                    res.cookies.set({ name, value, ...options });
                },
                remove: (name: string, options) => {
                    res.cookies.set({ name, value: '', ...options });
                },
            },
        }
    );

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return res;

    // Проверяем наличие имени в профиле - если нет, перенаправляем на страницу ввода имени
    // НО только если пользователь не на странице авторизации и не на главной (чтобы не блокировать вход)
    const isAuthPage = pathname.startsWith('/auth/');
    const isHomePage = pathname === '/';
    
    // Проверяем full_name только если пользователь не на страницах авторизации
    if (!isAuthPage && !isHomePage) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userRes.user.id)
            .maybeSingle();
        
        if (!profile?.full_name?.trim()) {
            // Редиректим на post-signup только если не на главной и не на auth страницах
            const url = req.nextUrl.clone();
            url.pathname = '/auth/post-signup';
            url.searchParams.set('from', 'middleware');
            return NextResponse.redirect(url, 302);
        }
    }

    const { data: roles, error } = await supabase.rpc('my_role_keys');
    if (error) {
        // Логируем ошибку, но не прерываем запрос - пользователь останется на главной
        console.warn('[middleware] Failed to get user roles:', error.message);
        return res;
    }

    const keys = Array.isArray(roles) ? (roles as string[]) : [];
    if (keys.includes('super_admin')) {
        const url = req.nextUrl.clone();
        url.pathname = '/admin';
        return NextResponse.redirect(url, 302);
    }
    // Владельцы, админы и менеджеры → dashboard
    if (keys.includes('owner') || keys.some(k => ['admin','manager'].includes(k))) {
        const url = req.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url, 302);
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
