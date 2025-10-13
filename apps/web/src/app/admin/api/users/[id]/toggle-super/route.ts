// apps/web/src/app/admin/api/users/[id]/toggle-super/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Body = { makeSuper: boolean };
type SuperAdminRow = { user_id: string };

export async function POST(req: Request, context: unknown) {
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string> }).params
            : {};
    try {
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // Парсим и валидируем тело
        const body = (await req.json()) as Body;
        if (typeof body?.makeSuper !== 'boolean') {
            return NextResponse.json({ok: false, error: 'Bad request: makeSuper boolean required'}, {status: 400});
        }
        const {makeSuper} = body;

        // Проверяем, что вызывающий — супер-админ
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

        // Админ-клиент (service role)
        const admin = createClient(URL, SERVICE);

        if (makeSuper) {
            // Назначить супер-админа (idempotent)
            const {error} = await admin
                .from('super_admins')
                .upsert({user_id: params.id} satisfies SuperAdminRow, {onConflict: 'user_id'});
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        } else {
            // Защита: не позволяем удалить последнего супер-админа
            const {count, error: cntErr} = await admin
                .from('super_admins')
                .select('user_id', {count: 'exact', head: true});
            if (cntErr) return NextResponse.json({ok: false, error: cntErr.message}, {status: 400});
            if ((count ?? 0) <= 1) {
                return NextResponse.json(
                    {ok: false, error: 'Нельзя удалить последнего супер-админа'},
                    {status: 400},
                );
            }

            const {error} = await admin.from('super_admins').delete().eq('user_id', params.id);
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        }

        return NextResponse.json({ok: true});
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('toggle-super error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
