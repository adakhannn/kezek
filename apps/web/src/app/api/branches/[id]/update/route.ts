export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    name: string;
    address?: string | null;
    is_active: boolean;
};

export async function POST(req: Request, context: unknown) {
    try {
        const branchId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = await req.json().catch(() => ({} as Body));
        if (!body.name?.trim()) return NextResponse.json({ ok: false, error: 'NAME_REQUIRED' }, { status: 400 });

        // проверим, что филиал принадлежит этому бизнесу
        const { data: br } = await admin
            .from('branches')
            .select('id,biz_id')
            .eq('id', branchId)
            .maybeSingle();

        if (!br || String(br.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }

        const { error: eUpd } = await admin
            .from('branches')
            .update({
                name: body.name.trim(),
                address: body.address ?? null,
                is_active: !!body.is_active,
            })
            .eq('id', branchId)
            .eq('biz_id', bizId);

        if (eUpd) return NextResponse.json({ ok: false, error: eUpd.message }, { status: 400 });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
