export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { logError, logWarn } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { withLocalizedMessages } from '@/lib/serverMessages';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

type Body = {
    user_ids?: string[]; // Массив ID владельцев
};

export const POST = withLocalizedMessages(async function POST(req: Request, ctx: unknown) {
    try {
        const bizId = await getRouteParamRequired(ctx, 'id');

        const raw = (await req.json()) as Body;
        const userIds = (raw.user_ids ?? []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

        // Кто вызывает — должен быть супер
        const supa = await createSupabaseServerClient();

        const { data: { user } } = await supa.auth.getUser();
        if (!user) {
            return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
        }

        const { data: isSuper, error: superErr } = await supa.rpc('is_super_admin');

        if (superErr) return NextResponse.json({ ok: false, error: superErr.message }, { status: 400 });
        if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

        // Сервис-клиент
        const admin = createSupabaseAdminClient();

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
        logError('OwnerSave', 'Failed to save business owners', e);
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
});

export const PUT = POST;
