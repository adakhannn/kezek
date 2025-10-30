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
    if (error) return res;

    const keys = Array.isArray(roles) ? (roles as string[]) : [];
    if (keys.includes('super_admin')) {
        const url = req.nextUrl.clone();
        url.pathname = '/admin';
        return NextResponse.redirect(url, 302);
    }
    if (keys.includes('owner') || keys.some(k => ['admin','manager','staff'].includes(k))) {
        const url = req.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url, 302);
    }

    return res;
}

export const config = {
    matcher: ['/',], // можно добавить: '/auth/sign-in', '/auth', ...
};
