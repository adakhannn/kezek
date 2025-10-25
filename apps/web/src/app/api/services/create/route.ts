export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    name_ru: string;
    duration_min: number;
    price_from: number;
    price_to: number;
    active?: boolean;
    branch_id: string;
};

export async function POST(req: Request) {
    try {
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = await req.json().catch(() => ({} as Body));
        if (!body.name_ru?.trim()) return NextResponse.json({ ok: false, error: 'NAME_REQUIRED' }, { status: 400 });
        if (!body.branch_id) return NextResponse.json({ ok: false, error: 'BRANCH_REQUIRED' }, { status: 400 });
        if (!body.duration_min || body.duration_min <= 0) return NextResponse.json({ ok: false, error: 'DURATION_INVALID' }, { status: 400 });

        // филиал принадлежит бизнесу?
        const { data: br } = await admin
            .from('branches')
            .select('id,biz_id')
            .eq('id', body.branch_id)
            .maybeSingle();
        if (!br || String(br.biz_id) !== String(bizId)) {
            return NextResponse.json({ ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS' }, { status: 400 });
        }

        const { data, error } = await admin
            .from('services')
            .insert({
                biz_id: bizId,
                branch_id: body.branch_id,
                name_ru: body.name_ru.trim(),
                duration_min: body.duration_min,
                price_from: body.price_from ?? 0,
                price_to: body.price_to ?? 0,
                active: body.active ?? true,
            })
            .select('id')
            .single();

        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

        return NextResponse.json({ ok: true, id: data?.id });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? 'UNKNOWN' }, { status: 500 });
    }
}
