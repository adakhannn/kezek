import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import {
    loadDashboardStaffDetail,
    loadDashboardStaffList,
    loadDashboardStaffScheduleContext,
} from '@/lib/dashboardStaffReadService';
import { getRouteParamUuid } from '@/lib/routeParams';

// Texts of the server dictionaries (serverStaff.*.ts): the app gets them in its language (FE-10).
const LOAD_FAILED = 'Не удалось загрузить данные сотрудника';
const NOT_FOUND = 'Сотрудник не найден или доступ запрещён';

/** GET /api/dashboard/staff: what /dashboard/staff shows, for the mobile app. */
export async function runDashboardStaffListHttp(): Promise<NextResponse> {
    const { supabase, bizId, userId, business } = await getBizContextForManagers();
    const result = await loadDashboardStaffList({ supabase, bizId, userId });
    if (!result.ok) return createErrorResponse('internal', LOAD_FAILED, undefined, 500);
    return createSuccessResponse({
        ...result.data,
        business: { name: business?.name ?? null, city: business?.city ?? null },
    });
}

/** GET /api/dashboard/staff/[id]: what /dashboard/staff/[id] shows, for the mobile app. */
export async function runDashboardStaffDetailHttp(context: unknown): Promise<NextResponse> {
    const staffId = await getRouteParamUuid(context, 'id');
    const { supabase, bizId, userId } = await getBizContextForManagers();
    const result = await loadDashboardStaffDetail({ supabase, bizId, userId }, staffId);
    if (!result.ok) {
        return result.reason === 'not_found'
            ? createErrorResponse('not_found', NOT_FOUND, undefined, 404)
            : createErrorResponse('internal', LOAD_FAILED, undefined, 500);
    }
    return createSuccessResponse(result.data);
}

/** GET /api/dashboard/staff/[id]/schedule-context: the server reads of /dashboard/staff/[id]/schedule. */
export async function runDashboardStaffScheduleContextHttp(context: unknown): Promise<NextResponse> {
    const staffId = await getRouteParamUuid(context, 'id');
    const { supabase, bizId, userId, business } = await getBizContextForManagers();
    const result = await loadDashboardStaffScheduleContext({ supabase, bizId, userId }, staffId);
    if (!result.ok) {
        return result.reason === 'not_found'
            ? createErrorResponse('not_found', NOT_FOUND, undefined, 404)
            : createErrorResponse('internal', LOAD_FAILED, undefined, 500);
    }
    return createSuccessResponse({
        ...result.data,
        business: { name: business?.name ?? null, city: business?.city ?? null },
    });
}
