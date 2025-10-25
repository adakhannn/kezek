export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    branch_id: string;
    is_active: boolean;
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
    try {
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        let body: Body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
        }

        if (!body.full_name || !body.branch_id) {
            return NextResponse.json({ ok: false, error: 'INVALID_BODY' }, { status: 400 });
        }

        // staff принадлежит бизнесу?
        const { data: staffRow, error: eStaff } = await admin
            .from('staff')
            .select('id,biz_id')
            .eq('id', params.id)
            .maybeSingle();
        if (eStaff) return NextResponse.json({ ok: false, error: eStaff.message }, { status: 400 });
        if (!staffRow || String(staffRow.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'STAFF_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }

        // branch принадлежит бизнесу?
        const { data: branchRow, error: eBr } = await admin
            .from('branches')
            .select('id,biz_id')
            .eq('id', body.branch_id)
            .maybeSingle();
        if (eBr) return NextResponse.json({ ok: false, error: eBr.message }, { status: 400 });
        if (!branchRow || String(branchRow.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }

        // обновление
        const { error: eUpd } = await admin
            .from('staff')
            .update({
                full_name: body.full_name,
                email: body.email ?? null,
                phone: body.phone ?? null,
                branch_id: body.branch_id,
                is_active: !!body.is_active,
            })
            .eq('id', params.id)
            .eq('biz_id', bizId);

        if (eUpd) return NextResponse.json({ ok: false, error: eUpd.message }, { status: 400 });

        return NextResponse.json({ ok: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        // Гарантированно JSON, даже при непойманных исключениях
        return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
    }
}
