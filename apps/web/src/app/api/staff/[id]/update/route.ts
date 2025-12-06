// apps/web/src/app/api/staff/[id]/update/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    branch_id: string;
    is_active: boolean;
};

export async function POST(req: Request, context: unknown) {
    try {
        const staffId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        let body: Body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
        }

        if (!staffId || !body.full_name || !body.branch_id) {
            return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
        }

        // 1) staff принадлежит бизнесу?
        const { data: st, error: eSt } = await admin
            .from('staff')
            .select('id,biz_id,branch_id')
            .eq('id', staffId)
            .maybeSingle();
        if (eSt) return NextResponse.json({ ok: false, error: eSt.message }, { status: 400 });
        if (!st || String(st.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'STAFF_NOT_IN_THIS_BUSINESS' }, { status: 403 });
        }

        // 2) новый branch принадлежит этому бизнесу?
        const { data: br, error: eBr } = await admin
            .from('branches')
            .select('id,biz_id,is_active')
            .eq('id', body.branch_id)
            .maybeSingle();
        if (eBr) return NextResponse.json({ ok: false, error: eBr.message }, { status: 400 });
        if (!br || String(br.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }
        if (br.is_active === false) {
            return NextResponse.json({ ok: false, error: 'TARGET_BRANCH_INACTIVE' }, { status: 400 });
        }

        const isBranchChanged = String(st.branch_id) !== String(body.branch_id);

        // 3) обновляем карточку сотрудника (ФИО, контакты, активность)
        {
            const { error: eUpd } = await admin
                .from('staff')
                .update({
                    full_name: body.full_name,
                    email: body.email ?? null,
                    phone: body.phone ?? null,
                    is_active: !!body.is_active,
                    // branch_id обновим ниже, если действительно перенос
                })
                .eq('id', staffId)
                .eq('biz_id', bizId);
            if (eUpd) return NextResponse.json({ ok: false, error: eUpd.message }, { status: 400 });
        }

        // 4) если филиал меняется — делаем корректный перенос (assignments + кэш)
        if (isBranchChanged) {
            const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

            // закрыть открытое назначение
            await admin
                .from('staff_branch_assignments')
                .update({ valid_to: today })
                .eq('staff_id', staffId)
                .is('valid_to', null);

            // создать новое назначение
            const { error: eIns } = await admin.from('staff_branch_assignments').insert({
                biz_id: bizId,
                staff_id: staffId,
                branch_id: body.branch_id,
                valid_from: today,
            });
            if (eIns) return NextResponse.json({ ok: false, error: eIns.message }, { status: 400 });

            // синхронизировать кэш
            const { error: eCache } = await admin
                .from('staff')
                .update({ branch_id: body.branch_id })
                .eq('id', staffId)
                .eq('biz_id', bizId);
            if (eCache) return NextResponse.json({ ok: false, error: eCache.message }, { status: 400 });
        }

        return NextResponse.json({ ok: true, transferred: isBranchChanged });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
