export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

export async function POST(_req: Request, context: unknown) {
    // безопасно достаём params.id без any
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    try {
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        // 1) филиал наш?
        const { data: br } = await admin
            .from('branches')
            .select('id,biz_id')
            .eq('id', params.id)
            .maybeSingle();
        if (!br || String(br.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }

        // 2) нет сотрудников?
        const { count: staffCount } = await admin
            .from('staff')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', bizId)
            .eq('branch_id', params.id);

        if ((staffCount ?? 0) > 0) {
            return NextResponse.json({ ok: false, error: 'HAS_STAFF' }, { status: 400 });
        }

        // 3) нет броней, привязанных к этому филиалу?
        const { count: bookCount } = await admin
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('biz_id', bizId)
            .eq('branch_id', params.id);

        if ((bookCount ?? 0) > 0) {
            return NextResponse.json({ ok: false, error: 'HAS_BOOKINGS' }, { status: 400 });
        }

        // 4) удаляем
        const { error: eDel } = await admin
            .from('branches')
            .delete()
            .eq('id', params.id)
            .eq('biz_id', bizId);

        if (eDel) return NextResponse.json({ ok: false, error: eDel.message }, { status: 400 });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
