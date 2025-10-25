export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    user_id: string;
    branch_id: string;
    is_active?: boolean;
};

export async function POST(req: Request) {
    try {
        // Доступ уже проверен внутри (владелец по owner_id ИЛИ owner/admin/manager по user_roles)
        const {bizId } = await getBizContextForManagers();

        const body = (await req.json()) as Body;
        if (!body.user_id || !body.branch_id) {
            return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
        }

        // service-клиентом обойдём RLS для мутаций
        const admin = getServiceClient();

        // 1) Проверим, что branch принадлежит этому бизнесу
        {
            const { data: br } = await admin
                .from('branches')
                .select('id,biz_id')
                .eq('id', body.branch_id)
                .maybeSingle();
            if (!br || String(br.biz_id) !== String(bizId)) {
                return NextResponse.json({ ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS' }, { status: 400 });
            }
        }

        // 2) Подтянем пользователя из Auth Admin API
        const { data: list, error: eList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        if (eList) return NextResponse.json({ ok: false, error: eList.message }, { status: 400 });
        const u = (list.users ?? []).find(x => x.id === body.user_id);
        if (!u) return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 });

        const meta = (u.user_metadata ?? {});
        const full_name = String(meta.full_name ?? meta.fullName ?? u.email ?? 'Без имени');
        const email = u.email ?? null;
        const phone = u.phone ?? null;

        // 3) Создаём запись staff (если вдруг уже есть — можно не дублировать)
        const { data: existingStaff } = await admin
            .from('staff')
            .select('id')
            .eq('biz_id', bizId)
            .eq('full_name', full_name)
            .limit(1)
            .maybeSingle();

        let staffId = existingStaff?.id as string | undefined;

        if (!staffId) {
            const { data: inserted, error: eIns } = await admin
                .from('staff')
                .insert({
                    biz_id: bizId,
                    branch_id: body.branch_id,
                    full_name,
                    email,
                    phone,
                    is_active: body.is_active ?? true,
                })
                .select('id')
                .single();
            if (eIns) return NextResponse.json({ ok: false, error: eIns.message }, { status: 400 });
            staffId = inserted?.id as string;
        }

        // 4) Выдаём роль staff пользователю в этом бизнесе (id роли по key='staff')
        const { data: roleStaff } = await admin
            .from('roles')
            .select('id')
            .eq('key', 'staff')
            .maybeSingle();
        if (!roleStaff?.id) return NextResponse.json({ ok: false, error: 'ROLE_STAFF_NOT_FOUND' }, { status: 400 });

        const ZERO = '00000000-0000-0000-0000-000000000000';

        // upsert вручную: если записи нет — вставим
        const { data: existsRole } = await admin
            .from('user_roles')
            .select('id')
            .eq('user_id', body.user_id)
            .eq('role_id', roleStaff.id)
            .eq('biz_id', bizId)
            .maybeSingle();

        if (!existsRole) {
            const { error: eRole } = await admin
                .from('user_roles')
                .insert({
                    user_id: body.user_id,
                    role_id: roleStaff.id,
                    biz_id: bizId,
                    biz_key: bizId ?? ZERO,
                });
            if (eRole) return NextResponse.json({ ok: true, id: staffId, warn: 'ROLE_NOT_GRANTED', error: eRole.message });
        }

        return NextResponse.json({ ok: true, id: staffId });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? 'UNKNOWN' }, { status: 500 });
    }
}
