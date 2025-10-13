// apps/web/src/app/admin/api/users/[id]/roles/remove/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

type Role = 'owner' | 'manager' | 'staff' | 'admin' | 'client';
type Body = { biz_id: string; role: Role };

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

        // Парсим и валидируем тело запроса
        const parsed = (await req.json()) as Partial<Body> | null;
        const bizId = parsed?.biz_id?.trim();
        const role = parsed?.role;

        const ROLES: Role[] = ['owner', 'manager', 'staff', 'admin', 'client'];
        if (!bizId || !role || !ROLES.includes(role)) {
            return NextResponse.json(
                {ok: false, error: 'Bad request: provide valid biz_id and role'},
                {status: 400},
            );
        }

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

        // Админ-клиент
        const admin = createClient(URL, SERVICE);

        // Защита: нельзя снять последнего владельца бизнеса
        if (role === 'owner') {
            const {count, error: cntErr} = await admin
                .from('user_roles')
                .select('user_id', {count: 'exact', head: true})
                .eq('biz_id', bizId)
                .eq('role', 'owner')
                .neq('user_id', params.id); // считаем других владельцев

            if (cntErr) {
                return NextResponse.json({ok: false, error: cntErr.message}, {status: 400});
            }
            // если других владельцев нет, запрещаем удаление
            if ((count ?? 0) === 0) {
                return NextResponse.json(
                    {ok: false, error: 'Нельзя удалить единственного владельца бизнеса'},
                    {status: 400},
                );
            }
        }

        // Удаляем роль
        const {error} = await admin
            .from('user_roles')
            .delete()
            .eq('user_id', params.id)
            .eq('biz_id', bizId)
            .eq('role', role);

        if (error) {
            return NextResponse.json({ok: false, error: error.message}, {status: 400});
        }

        return NextResponse.json({ok: true});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('role remove error', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
