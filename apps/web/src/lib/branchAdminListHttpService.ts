import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { BizAccessError } from '@/lib/authDiagnostics';
import { getRouteParam } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

type BranchAdminSource = 'owner' | 'biz_admin' | 'branch_admin';
type BranchAdminContact = { email: string | null; phone: string | null; full_name: string | null };

const NO_CONTACT: BranchAdminContact = { email: null, phone: null, full_name: null };

/**
 * Lists the effective administrators of one branch with their contact details.
 * The service-role lookups expose emails and phones, so they run only after the
 * caller's own session proves the branch belongs to the caller's business.
 */
export async function runBranchAdminListHttp(context: unknown) {
    let caller: Awaited<ReturnType<typeof getBizContextForManagers>>;
    try { caller = await getBizContextForManagers(); }
    catch (error) {
        if (!(error instanceof BizAccessError)) throw error;
        if (error.code === 'NOT_AUTHENTICATED') return createErrorResponse('auth', 'Требуется авторизация', undefined, 401);
        if (error.code === 'SERVICE_UNAVAILABLE') return createErrorResponse('service_unavailable', 'Проверка доступа недоступна', undefined, 503);
        return createErrorResponse('forbidden', 'Нет доступа к управлению филиалом', undefined, 403);
    }
    const branchId = await getRouteParam(context, 'id');
    if (!z.string().uuid().safeParse(branchId).success) return createErrorResponse('validation', 'Неверный идентификатор филиала', undefined, 400);
    const { data: branch, error: readError } = await caller.supabase.from('branches').select('id')
        .eq('id', branchId!).eq('biz_id', caller.bizId).maybeSingle();
    if (readError) return createErrorResponse('service_unavailable', 'Не удалось проверить филиал', undefined, 503);
    if (!branch) return createErrorResponse('forbidden', 'Филиал недоступен в выбранном бизнесе', undefined, 403);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('branch_admins_effective', { p_branch_id: branchId! });
    if (error) return createErrorResponse('service_unavailable', 'Не удалось загрузить администраторов', undefined, 503);
    const rows = (data ?? []) as Array<{ user_id: string; source: BranchAdminSource }>;

    // auth_users_view is not readable by authenticated users after the Security Advisor fixes.
    const contacts = new Map<string, BranchAdminContact>();
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    if (userIds.length) {
        const { data: users, error: usersError } = await admin.from('auth_users_view')
            .select('id,email,phone,full_name').in('id', userIds);
        if (usersError) return createErrorResponse('service_unavailable', 'Не удалось загрузить контакты администраторов', undefined, 503);
        for (const user of users ?? []) {
            if (user.id) contacts.set(user.id, { email: user.email ?? null, phone: user.phone ?? null, full_name: user.full_name ?? null });
        }
    }

    return NextResponse.json({
        ok: true,
        items: rows.map((row) => ({ user_id: row.user_id, source: row.source, ...(contacts.get(row.user_id) ?? NO_CONTACT) })),
    });
}
