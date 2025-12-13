import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_: Request, context: unknown) {
    try {
        const staffId = await getRouteParamRequired(context, 'id');
        const { supabase, bizId } = await getBizContextForManagers();

    // 1) читаем сотрудника
    const { data: staff, error: eStaff } = await supabase
        .from('staff')
        .select('id,biz_id,user_id,is_active')
        .eq('id', staffId)
        .maybeSingle();

    if (eStaff) return NextResponse.json({ ok: false, error: eStaff.message }, { status: 400 });
    if (!staff || String(staff.biz_id) !== String(bizId))
        return NextResponse.json({ ok: false, error: 'STAFF_NOT_FOUND' }, { status: 404 });

    // 2) включаем карточку
    const { error: eUpd } = await supabase
        .from('staff')
        .update({ is_active: true })
        .eq('id', staffId)
        .eq('biz_id', bizId);

    if (eUpd) return NextResponse.json({ ok: false, error: eUpd.message }, { status: 400 });

    // 3) вернём роль staff (если привязан к user_id)
    if (staff.user_id) {
        const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false } }
        );

        const { data: roleStaff, error: eRole } = await svc
            .from('roles')
            .select('id')
            .eq('key', 'staff')
            .maybeSingle();

        if (eRole || !roleStaff?.id)
            return NextResponse.json({ ok: false, error: 'ROLE_STAFF_NOT_FOUND' }, { status: 500 });

        await svc
            .from('user_roles')
            .upsert(
                { user_id: staff.user_id, biz_id: bizId, role_id: roleStaff.id },
                { onConflict: 'user_id,role_id,biz_key' }
            );
    }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
