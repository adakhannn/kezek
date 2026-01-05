// apps/web/src/app/admin/api/users/[id]/send-magic-link/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

export async function POST(_req: Request, context: unknown) {
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string> }).params
            : {};
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'http://localhost:3000';
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // Проверяем, что вызвавший — супер-админ
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

        // Admin client (service role)
        const admin = createClient(URL, SERVICE);

        // Берём email пользователя
        const {data: userResp, error: eGet} = await admin.auth.admin.getUserById(params.id);
        if (eGet) return NextResponse.json({ok: false, error: eGet.message}, {status: 400});

        const email = userResp?.user?.email ?? null;
        if (!email) {
            return NextResponse.json({ok: false, error: 'У пользователя нет email'}, {status: 400});
        }

        // Генерируем magic-link (Supabase также отправит письмо, если настроен SMTP)
        const {data: linkData, error: eGen} = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: {redirectTo: `${SITE}/auth/callback?next=/admin`},
        });
        if (eGen) return NextResponse.json({ok: false, error: eGen.message}, {status: 400});

        const actionLink =
            (linkData as { properties?: { action_link?: string | null } } | null)?.properties?.action_link ?? null;

        return NextResponse.json({ok: true, link: actionLink});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('send-magic-link error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
