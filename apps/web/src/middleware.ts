import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    // проверяем только главную (можешь расширить список путей)
    if (req.nextUrl.pathname !== '/') return NextResponse.next();

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
    matcher: ['/',], // можно добавить: '/auth/sign-in', '/auth', ...
};
