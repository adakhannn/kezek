// apps/web/src/app/admin/api/businesses/[id]/members/grant/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {createServerClient} from '@supabase/ssr';
import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';

export async function POST(req: Request, context: unknown) {
    // безопасно достаём params.id без any
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    try {
        const biz_id = params?.id ?? '';
        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: n => cookieStore.get(n)?.value, set: () => {
                }, remove: () => {
                }
            },
        });

        // проверка авторизации/прав
        const {data: {user}} = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        // super_admin (global) ИЛИ owner/admin данного бизнеса
        const {data: superRow} = await supa
            .from('user_roles_with_user')
            .select('user_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        let allowed = !!superRow;
        if (!allowed) {
            const {data: isOwner} = await supa.rpc('has_role', {p_role: 'owner', p_biz_id: biz_id});
            const {data: isAdmin} = await supa.rpc('has_role', {p_role: 'admin', p_biz_id: biz_id});
            allowed = !!isOwner || !!isAdmin;
        }
        if (!allowed) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // входные данные
        type Body = { user_id?: string; role_key?: 'owner' | 'admin' | 'manager' | 'staff' | 'client' };
        const body = (await req.json()) as Body;
        const user_id = (body.user_id ?? '').trim();
        const role_key = body.role_key ?? 'client';
        if (!user_id) return NextResponse.json({ok: false, error: 'bad user_id'}, {status: 400});

        const admin = createClient(URL, SERVICE);

        // находим role_id по ключу
        const {data: roleRow, error: roleErr} = await admin
            .from('roles')
            .select('id')
            .eq('key', role_key)
            .maybeSingle();
        if (roleErr || !roleRow) {
            return NextResponse.json({ok: false, error: 'role not found'}, {status: 400});
        }

        // ПИШЕМ ЧЕРЕЗ INSERT, а дубль игнорим по 23505 (unique_violation)
        const {error: insErr} = await admin
            .from('user_roles')
            .insert({user_id, role_id: roleRow.id, biz_id});

        if (insErr && insErr.code !== '23505') {
            // 23505 — уже есть такая роль → не считаем ошибкой
            return NextResponse.json({ok: false, error: insErr.message}, {status: 400});
        }

        // если выдаём 'owner' — обновим поле owner_id у бизнеса
        if (role_key === 'owner') {
            await admin.from('businesses').update({owner_id: user_id}).eq('id', biz_id);
        }

        return NextResponse.json({ok: true});
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
