import { isUuid } from '@shared-client/validation';
import type { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { listActiveStaffRecords } from '@/lib/staffRoleSync';
import { STAFF_SELECTION_COOKIE } from '@/lib/staffSelection';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Remembers which of the caller's staff cards the web cabinet acts as (ARCH-02). The card must be
 * one of the caller's own active cards. The cookie is only a preference: every staff request
 * checks its card again.
 */
export async function runSetCurrentStaffHttp(req: Request): Promise<NextResponse> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const body = (await req.json().catch(() => null)) as { staffId?: unknown } | null;
    const staffId = typeof body?.staffId === 'string' ? body.staffId.trim() : '';
    if (!isUuid(staffId)) {
        return createErrorResponse('validation', 'Некорректный идентификатор сотрудника', undefined, 400);
    }

    const records = await listActiveStaffRecords(supabase, data.user.id);
    if (!records.some((record) => record.id === staffId)) {
        return createErrorResponse('forbidden', 'Нет доступа к кабинету сотрудника', { code: 'NO_STAFF_ACCESS' }, 403);
    }

    const response = createSuccessResponse();
    response.cookies.set(STAFF_SELECTION_COOKIE, staffId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: ONE_YEAR_SECONDS,
    });
    return response;
}
