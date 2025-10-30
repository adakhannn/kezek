export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    name: string;
    address?: string | null;
    is_active?: boolean;
};

export async function POST(req: Request) {
    try {
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = await req.json().catch(() => ({} as Body));
        if (!body.name?.trim()) {
            return NextResponse.json({ ok: false, error: 'NAME_REQUIRED' }, { status: 400 });
        }

        const { data, error } = await admin
            .from('branches')
            .insert({
                biz_id: bizId,
                name: body.name.trim(),
                address: body.address ?? null,
                is_active: body.is_active ?? true,
            })
            .select('id')
            .single();

        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

        return NextResponse.json({ ok: true, id: data?.id });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
