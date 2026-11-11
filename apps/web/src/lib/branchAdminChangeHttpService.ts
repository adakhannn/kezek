import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { BizAccessError } from '@/lib/authDiagnostics';
import { getRouteParam } from '@/lib/routeParams';
import { validateRequest } from '@/lib/validation/apiValidation';

const bodySchema = z.object({ user_id: z.string().uuid() }).strict();

export async function runBranchAdminChangeHttp(req: Request, context: unknown, action: 'add' | 'remove') {
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
    const validation = await validateRequest(req, bodySchema);
    if (!validation.success) return validation.response;
    const { data: branch, error: readError } = await caller.supabase.from('branches').select('id')
        .eq('id', branchId!).eq('biz_id', caller.bizId).maybeSingle();
    if (readError) return createErrorResponse('service_unavailable', 'Не удалось проверить филиал', undefined, 503);
    if (!branch) return createErrorResponse('forbidden', 'Филиал недоступен в выбранном бизнесе', undefined, 403);
    // Keep the caller's authenticated session. The checked SQL function repeats
    // authorization under the branch row lock, including direct RPC requests.
    const { error } = await caller.supabase.rpc(action === 'add' ? 'grant_branch_admin' : 'revoke_branch_admin', {
        p_branch_id: branchId, p_user_id: validation.data.user_id,
    });
    if (error?.code === '42501') return createErrorResponse('forbidden', 'Нет доступа к управлению филиалом', undefined, 403);
    if (error?.code === '23503') return createErrorResponse('validation', 'Пользователь не найден', undefined, 400);
    if (error) return createErrorResponse('internal', 'Изменение прав не подтверждено', undefined, 500);
    return NextResponse.json({ ok: true });
}
