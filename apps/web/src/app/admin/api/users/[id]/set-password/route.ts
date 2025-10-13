// apps/web/src/app/admin/api/users/[id]/set-password/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { password: string };

export async function POST(req: Request, context: unknown) {
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string> }).params
            : {};
    // базовая валидация тела
    const body = (await req.json()) as Body;
    if (!body?.password || typeof body.password !== 'string' || body.password.trim().length < 8) {
        return NextResponse.json({ok: false, error: 'Пароль минимум 8 символов'}, {status: 400});
    }

    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // проверка, что вызывает супер-админ
        const cookieStore = await cookies();
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        const {
            data: {user},
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // смена пароля через Admin API
        const admin = createClient(URL, SERVICE);
        const {error: updErr} = await admin.auth.admin.updateUserById(params.id, {
            password: body.password.trim(),
        });
        if (updErr) {
            return NextResponse.json({ok: false, error: updErr.message}, {status: 400});
        }

        return NextResponse.json({ok: true});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('set-password error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
