export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {logWarn} from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';

type Body = {
    user_ids?: string[]; // Массив ID владельцев
};

export async function POST(req: Request, ctx: unknown) {
    try {
        const bizId = await getRouteParamRequired(ctx, 'id');

        const raw = (await req.json()) as Body;
        const userIds = (raw.user_ids ?? []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

        const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        // Кто вызывает — должен быть супер
        const supa = createServerClient(URL, ANON, {
            cookies: {
                get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {},
            },
        });

        const { data: { user } } = await supa.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
        }

        const { data: superRow, error: superErr } = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();

        if (superErr) return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        if (!superRow) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        // Сервис-клиент
        const admin = createClient(URL, SERVICE);

        // Получаем role_id для роли 'owner'
        const { data: ownerRole, error: roleErr } = await admin
            .from('roles')
            .select('id')
            .eq('key', 'owner')
            .maybeSingle();

        if (roleErr || !ownerRole) {
            return NextResponse.json({ ok: false, error: 'Роль owner не найдена' }, { status: 400 });
        }

        // Проверяем всех пользователей перед добавлением
        for (const userId of userIds) {
            const { data: targetUser, error: getUserErr } = await admin.auth.admin.getUserById(userId);
            if (getUserErr || !targetUser?.user) {
                return NextResponse.json({ ok: false, error: `Пользователь ${userId} не найден в системе` }, { status: 404 });
            }
            // Проверяем, не заблокирован ли пользователь через user_suspensions
            const { data: suspension } = await admin
                .from('user_suspensions')
                .select('user_id')
                .eq('user_id', userId)
                .limit(1)
                .maybeSingle();
            if (suspension) {
                return NextResponse.json(
                    { ok: false, error: 'Один из пользователей заблокирован и не может быть назначен владельцем.', code: 'USER_SUSPENDED' },
                    { status: 400 }
                );
            }
        }

        // Удаляем все существующие роли owner для этого бизнеса
        const { error: deleteErr } = await admin
            .from('user_roles')
            .delete()
            .eq('biz_id', bizId)
            .eq('role_id', ownerRole.id);

        if (deleteErr) {
            return NextResponse.json({ ok: false, error: deleteErr.message }, { status: 400 });
        }

        // Добавляем новых владельцев
        if (userIds.length > 0) {
            const ownerRoles = userIds.map(userId => ({
                user_id: userId,
                biz_id: bizId,
                role_id: ownerRole.id,
            }));

            const { error: insertErr } = await admin
                .from('user_roles')
                .insert(ownerRoles);

            if (insertErr) {
                return NextResponse.json({ ok: false, error: insertErr.message }, { status: 400 });
            }

            // Обновляем owner_id в businesses на первого владельца (для обратной совместимости)
            const { error: updateErr } = await admin
                .from('businesses')
                .update({ owner_id: userIds[0] })
                .eq('id', bizId);

            if (updateErr) {
                logWarn('OwnerSave', 'Failed to update owner_id in businesses', { bizId, error: updateErr });
            }
        } else {
            // Если владельцев нет, очищаем owner_id
            const { error: updateErr } = await admin
                .from('businesses')
                .update({ owner_id: null })
                .eq('id', bizId);

            if (updateErr) {
                logWarn('OwnerSave', 'Failed to clear owner_id in businesses', { bizId, error: updateErr });
            }
        }

        return NextResponse.json({ ok: true, owner_ids: userIds });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}

export const PUT = POST;
