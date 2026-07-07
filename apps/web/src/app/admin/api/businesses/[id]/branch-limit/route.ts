export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getRouteParamRequired } from '@/lib/routeParams';

export async function POST(request: Request, context: unknown) {
    const businessId = await getRouteParamRequired(context, 'id');
    const cookieStore = await cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: { get: (name: string) => cookieStore.get(name)?.value, set: () => {}, remove: () => {} },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as { branch_limit?: unknown };
    const branchLimit = body.branch_limit;
    if (!Number.isInteger(branchLimit) || Number(branchLimit) < 1 || Number(branchLimit) > 1000) {
        return NextResponse.json({ ok: false, error: 'Лимит должен быть целым числом от 1 до 1000' }, { status: 400 });
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { count, error: countError } = await admin.from('branches').select('id', { count: 'exact', head: true }).eq('biz_id', businessId);
    if (countError) return NextResponse.json({ ok: false, error: countError.message }, { status: 400 });
    if (Number(branchLimit) < (count ?? 0)) {
        return NextResponse.json({ ok: false, error: `Лимит не может быть меньше текущего количества филиалов (${count ?? 0})` }, { status: 409 });
    }

    const { error } = await admin.from('businesses').update({ branch_limit: Number(branchLimit) }).eq('id', businessId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, branch_limit: Number(branchLimit) });
}
