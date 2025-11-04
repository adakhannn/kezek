export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';

export async function POST(req: Request, ctx: unknown) {
    try {
        const params =
            typeof ctx === 'object' && ctx && 'params' in ctx
                ? (ctx as { params: Record<string, string> }).params
                : {};
        const branchId = params.id;

        const { supabase } = await getBizContextForManagers();

        const { user_id } = await req.json();
        if (!user_id) return NextResponse.json({ ok: false, error: 'user_id required' }, { status: 400 });

        const { error } = await supabase.rpc('revoke_branch_admin', { p_branch_id: branchId, p_user_id: user_id });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
