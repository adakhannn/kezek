// apps/web/src/app/admin/api/users/[id]/delete/route.ts
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
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        // проверяем, что запрос от залогиненного супер-админа
        const cookieStore = await cookies();
        const supa = createServerClient(SUPABASE_URL, ANON_KEY, {
            cookies: {
                get: (n) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        const {
            data: {user: me},
        } = await supa.auth.getUser();
        if (!me) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: eSuper.message}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // нельзя удалить самого себя
        if (params.id === me.id) {
            return NextResponse.json({ok: false, error: 'Нельзя удалить самого себя'}, {status: 400});
        }

        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

        // защита: если удаляется супер-админ — убедимся, что он не последний
        const {count: isTargetSuper, error: eChk1} = await admin
            .from('super_admins')
            .select('user_id', {head: true, count: 'exact'})
            .eq('user_id', params.id);
        if (eChk1) return NextResponse.json({ok: false, error: eChk1.message}, {status: 400});

        if ((isTargetSuper ?? 0) > 0) {
            const {count: totalSupers, error: eChk2} = await admin
                .from('super_admins')
                .select('user_id', {head: true, count: 'exact'});
            if (eChk2) return NextResponse.json({ok: false, error: eChk2.message}, {status: 400});
            if ((totalSupers ?? 0) <= 1) {
                return NextResponse.json(
                    {ok: false, error: 'Нельзя удалить последнего супер-админа'},
                    {status: 400},
                );
            }
        }

        // 1) снять владельца у бизнесов, где он указан в owner_id
        {
            const {error} = await admin.from('businesses').update({owner_id: null}).eq('owner_id', params.id);
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        }

        // 2) обнулить client_id в бронированиях (FK)
        {
            const {error} = await admin.from('bookings').update({client_id: null}).eq('client_id', params.id);
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        }

        // 3) убрать все роли
        {
            const {error} = await admin.from('user_roles').delete().eq('user_id', params.id);
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        }

        // 4) убрать супер-админа (если был)
        {
            const {error} = await admin.from('super_admins').delete().eq('user_id', params.id);
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        }

        // 5) (опционально) удалить профиль, если нет ON DELETE CASCADE
        // await admin.from('profiles').delete().eq('id', params.id);

        // 6) удалить из auth.users
        {
            const {error} = await admin.auth.admin.deleteUser(params.id);
            if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});
        }

        return NextResponse.json({ok: true});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('user delete error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}

// поддержим HTTP DELETE
export const DELETE = POST;
