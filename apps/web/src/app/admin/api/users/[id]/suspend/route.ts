export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

import { getRouteParamRequired } from '@/lib/routeParams';

type Body = { block: boolean; reason?: string };

export async function POST(req: Request, context: unknown) {
    try {
        const targetId = await getRouteParamRequired(context, 'id');

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        const {
            data: {user: me},
        } = await supa.auth.getUser();
        if (!me) return NextResponse.json({ok: false, error: 'UNAUTHORIZED'}, {status: 401});
        if (me.id === targetId) return NextResponse.json({ok: false, error: 'cannot block yourself'}, {status: 400});

        // доступ: глобальный супер-админ
        const {data: superRow, error: superErr} = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();
        if (superErr) return NextResponse.json({ok: false, error: superErr.message}, {status: 400});
        if (!superRow) return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});

        const admin = createClient(URL, SERVICE);

        // нельзя блокировать глобального супер-админа
        const {data: victimSuper} = await admin
            .from('user_roles_with_user')
            .select('user_id')
            .eq('user_id', targetId)
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();
        if (victimSuper) {
            return NextResponse.json({ok: false, error: 'cannot block a global super admin'}, {status: 400});
        }

        const body = (await req.json().catch(() => ({}))) as Partial<Body>;
        const block = !!body.block;
        const reason = body.reason?.toString().slice(0, 500) || null;

        if (block) {
            // 1) удаляем активные роли — отрезаем доступ по RLS
            await admin.from('user_roles').delete().eq('user_id', targetId);

            // 2) деактивируем и отвязываем staff, чтобы не появлялся в расписаниях
            await admin.from('staff').update({is_active: false, user_id: null}).eq('user_id', targetId);

            // 3) помечаем как заблокированного
            await admin.from('user_suspensions').upsert({
                user_id: targetId,
                reason,
                created_by: me.id,
            });

            // 4) инвалидируем все сессии
            await (admin).auth.admin.signOut?.(targetId).catch(() => {
            });
            // Старый метод (может отсутствовать в типах, но существует в рантайме)
            // @ts-expect-error - invalidateRefreshTokens может отсутствовать в типах @supabase/supabase-js,
            // но метод существует в runtime для Supabase Auth Admin API
            await admin.auth.admin.invalidateRefreshTokens?.(targetId).catch(() => {
            });

            return NextResponse.json({ok: true, blocked: true});
        } else {
            // Разблокировка — снимаем флаг; роли при необходимости вернёшь вручную
            await admin.from('user_suspensions').delete().eq('user_id', targetId);
            return NextResponse.json({ok: true, blocked: false});
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
