export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {logWarn} from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';

type Biz = { id: string; name: string | null; slug: string | null };

export async function POST(_req: Request, context: unknown) {
    try {
        const id = await getRouteParamRequired(context, 'id');

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const {
            data: { user: me },
        } = await supa.auth.getUser();
        if (!me) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
        if (me.id === id) return NextResponse.json({ ok: false, error: 'cannot delete yourself' }, { status: 400 });

        // супер-админ (глоб)
        const { data: superRow, error: superErr } = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();
        if (superErr) return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        if (!superRow) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        const admin = createClient(URL, SERVICE);

        // нельзя удалить глобального супер-админа
        const { data: victimSuper } = await admin
            .from('user_roles_with_user')
            .select('user_id')
            .eq('user_id', id)
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();
        if (victimSuper) {
            return NextResponse.json({ ok: false, error: 'Нельзя удалить глобального супер-админа' }, { status: 400 });
        }

        // мягкая отвязка (на всякий)
        await Promise.allSettled([
            admin.from('profiles').delete().eq('id', id),
            admin.from('user_roles').delete().eq('user_id', id),
            admin.from('user_global_roles').delete().eq('user_id', id),
            admin.from('super_admins_legacy').delete().eq('user_id', id),
            admin.from('staff').update({ user_id: null }).eq('user_id', id),
            admin.from('businesses').update({ owner_id: null }).eq('owner_id', id),
            admin.from('bookings').update({ client_id: null }).eq('client_id', id),
        ]);

        // попытка удалить из Auth
        const del = await admin.auth.admin.deleteUser(id);
        if (del.error) {
            const msg = del.error.message || '';

            // Любая загадочная БД-ошибка → предлагаем блокировку вместо удаления
            if (msg.includes('Database error deleting user')) {
                // Соберём бизнесы для подсказки (если получится)
                let owned: Biz[] = [];
                try {
                    const { data, error } = await admin.from('businesses').select('id,name,slug').eq('owner_id', id);
                    if (error) {
                        logWarn('UserDelete', 'Failed to fetch owned businesses', { userId: id, error: error.message });
                    }
                    owned = data ?? [];
                } catch (e) {
                    // Не критично, если не удалось получить список бизнесов - просто не показываем их
                    logWarn('UserDelete', 'Error fetching owned businesses', { userId: id, error: e });
                }

                return NextResponse.json(
                    {
                        ok: false,
                        code: 'DELETE_BLOCKED_USE_SUSPEND',
                        message:
                            'Удаление не удалось из-за ограничений БД/RLS. Заблокируйте пользователя вместо удаления (вверху кнопка «Заблокировать»).',
                        businesses: owned,
                    },
                    { status: 409 },
                );
            }

            return NextResponse.json({ ok: false, error: msg }, { status: 400 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export const DELETE = POST;
