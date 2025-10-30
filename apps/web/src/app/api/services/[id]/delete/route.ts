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

        // услуга принадлежит бизнесу?
        const { data: svc } = await admin
            .from('services')
            .select('id,biz_id')
            .eq('id', params.id)
            .maybeSingle();
        if (!svc || String(svc.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'SERVICE_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }

        // (по желанию) проверить отсутствие зависимостей

        const { error: eDel } = await admin
            .from('services')
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
