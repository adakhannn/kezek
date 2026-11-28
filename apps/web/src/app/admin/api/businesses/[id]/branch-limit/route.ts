export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { DATABASE_FAILURE_MESSAGES, reportDatabaseError } from '@/lib/apiErrorHandler';
import { getRouteParamRequired } from '@/lib/routeParams';
import { withLocalizedMessages } from '@/lib/serverMessages';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const POST = withLocalizedMessages(async function POST(request: Request, context: unknown) {
    const businessId = await getRouteParamRequired(context, 'id');
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    if (!isSuper) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const body = (await request.json().catch(() => ({}))) as { branch_limit?: unknown };
    const branchLimit = body.branch_limit;
    if (!Number.isInteger(branchLimit) || Number(branchLimit) < 1 || Number(branchLimit) > 1000) {
        return NextResponse.json({ ok: false, error: 'Лимит должен быть целым числом от 1 до 1000' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { count, error: countError } = await admin.from('branches').select('id', { count: 'exact', head: true }).eq('biz_id', businessId);
    if (countError) return NextResponse.json({ ok: false, error: reportDatabaseError('AdminBusinessesBranchLimit', countError, DATABASE_FAILURE_MESSAGES.load) }, { status: 400 });
    if (Number(branchLimit) < (count ?? 0)) {
        return NextResponse.json({ ok: false, error: `Лимит не может быть меньше текущего количества филиалов (${count ?? 0})` }, { status: 409 });
    }

    const { error } = await admin.from('businesses').update({ branch_limit: Number(branchLimit) }).eq('id', businessId);
    if (error) return NextResponse.json({ ok: false, error: reportDatabaseError('AdminBusinessesBranchLimit', error, DATABASE_FAILURE_MESSAGES.save) }, { status: 400 });
    return NextResponse.json({ ok: true, branch_limit: Number(branchLimit) });
});
