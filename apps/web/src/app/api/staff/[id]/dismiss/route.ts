import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: { id: string } }) {
    const { supabase, bizId } = await getBizContextForManagers();
    const staffId = params.id;

    // 1) читаем сотрудника
    const { data: staff, error: eStaff } = await supabase
        .from('staff')
        .select('id,biz_id,user_id,is_active,full_name')
        .eq('id', staffId)
        .maybeSingle();

    if (eStaff) return NextResponse.json({ ok: false, error: eStaff.message }, { status: 400 });
    if (!staff || String(staff.biz_id) !== String(bizId)) {
        return NextResponse.json({ ok: false, error: 'STAFF_NOT_FOUND' }, { status: 404 });
    }

    // 2) есть ли будущие активные записи?
    const nowIso = new Date().toISOString();
    const { count, error: eBooks } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('biz_id', bizId)
        .eq('staff_id', staffId)
        .neq('status', 'cancelled')
        .gt('start_at', nowIso);

    if (eBooks) return NextResponse.json({ ok: false, error: eBooks.message }, { status: 400 });
    if ((count ?? 0) > 0) {
        return NextResponse.json({ ok: false, error: 'HAS_FUTURE_BOOKINGS' }, { status: 409 });
    }

    // 3) деактивируем сотрудника
    const { error: eDeactivate } = await supabase
        .from('staff')
        .update({ is_active: false })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (eDeactivate) return NextResponse.json({ ok: false, error: eDeactivate.message }, { status: 400 });

    // 4) если привязан к пользователю — понизить роли до client
    if (staff.user_id) {
        // сервис-клиент (SERVER-ONLY ключ!)
        const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        // найдём id роли client
        const { data: roleClient, error: eRoleCli } = await svc
            .from('roles')
            .select('id')
            .eq('key', 'client')
            .maybeSingle();

        if (eRoleCli || !roleClient?.id) {
            return NextResponse.json({ ok: false, error: 'ROLE_CLIENT_NOT_FOUND' }, { status: 500 });
        }

        // снимем все бизнес-роли, кроме client
        const { error: eDelete } = await svc
            .from('user_roles')
            .delete()
            .eq('user_id', staff.user_id)
            .eq('biz_id', bizId)
            .neq('role_id', roleClient.id);

        if (eDelete) {
            return NextResponse.json({ ok: false, error: eDelete.message }, { status: 400 });
        }

        // гарантируем, что client есть
        const { data: roleClientId } = await svc
            .from('roles')
            .select('id')
            .eq('key', 'client')
            .maybeSingle();

        await svc
            .from('user_roles')
            .upsert(
                { user_id: staff.user_id, biz_id: bizId, role_id: roleClientId!.id },
                { onConflict: 'user_id,role_id,biz_key' } // как мы стандартизировали
            );
    }

    return NextResponse.json({ ok: true });
}
