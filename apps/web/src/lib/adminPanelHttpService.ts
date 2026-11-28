import { NextResponse } from 'next/server';

import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import {
    adminSystemChecks,
    isAdminDataConfigured,
    readAdminBranchDetail,
    readAdminBusinessApplications,
    readAdminBusinessBranches,
    readAdminBusinessDetail,
    readAdminBusinessList,
    readAdminHomeSummary,
    readAdminUserDetail,
    readAdminUserStats,
} from '@/lib/adminPanelReadService';
import { createErrorResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { getRouteParam } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { isUuid } from '@/lib/validation';

/**
 * JSON reads of the /admin pages for the mobile app (Bearer) and any other client: the same
 * service code the server-rendered pages use (lib/adminPanelReadService.ts). Each read runs only
 * after the caller is verified as a global super admin; failures are errors, never empty data.
 */

/**
 * A failed admin read: the raw database text goes to the log (Sentry), the client gets the
 * generic message and the read's machine code as details.reason (R25-29, ENG-47).
 */
function loadFailed(scope: string, failure: { error: string; message: string | null } | null) {
    if (failure) logError(scope, 'Admin read failed', { reason: failure.error, message: failure.message });
    return createErrorResponse('service_unavailable', 'Не удалось загрузить данные админки', failure ? { reason: failure.error } : undefined, 503);
}

async function uuidParam(context: unknown, key: string): Promise<string | null> {
    const value = await getRouteParam(context, key);
    return value && isUuid(value) ? value : null;
}

export function runAdminOverviewHttp() {
    return withErrorHandler('AdminOverview', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        const checks = adminSystemChecks();
        if (!isAdminDataConfigured()) {
            return NextResponse.json({ ok: true, configured: false, checks });
        }
        const summary = await readAdminHomeSummary(createSupabaseAdminClient());
        return NextResponse.json({ ok: true, configured: true, checks, ...summary });
    });
}

export function runAdminBusinessListHttp() {
    return withErrorHandler('AdminBusinessList', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        const result = await readAdminBusinessList(access.supabase, createSupabaseAdminClient());
        if (!result.ok) return loadFailed('AdminBusinessList', result);
        return NextResponse.json({ ok: true, items: result.items });
    });
}

export function runAdminBusinessDetailHttp(context: unknown) {
    return withErrorHandler('AdminBusinessDetail', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        const id = await uuidParam(context, 'id');
        if (!id) return createErrorResponse('validation', 'Неверный идентификатор бизнеса', undefined, 400);
        const result = await readAdminBusinessDetail(createSupabaseAdminClient(), id);
        if (!result.ok) {
            return result.error === 'not_found'
                ? createErrorResponse('not_found', 'Бизнес не найден', undefined, 404)
                : loadFailed('AdminBusinessDetail', result);
        }
        return NextResponse.json(result);
    });
}

export function runAdminBranchListHttp(context: unknown) {
    return withErrorHandler('AdminBranchList', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        const id = await uuidParam(context, 'id');
        if (!id) return createErrorResponse('validation', 'Неверный идентификатор бизнеса', undefined, 400);
        const result = await readAdminBusinessBranches(createSupabaseAdminClient(), id);
        if (!result.ok) {
            return result.error === 'not_found'
                ? createErrorResponse('not_found', 'Бизнес не найден', undefined, 404)
                : loadFailed('AdminBranchList', result);
        }
        return NextResponse.json(result);
    });
}

export function runAdminBranchDetailHttp(context: unknown) {
    return withErrorHandler('AdminBranchDetail', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        const id = await uuidParam(context, 'id');
        const branchId = await uuidParam(context, 'branchId');
        if (!id || !branchId) return createErrorResponse('validation', 'Неверный идентификатор филиала', undefined, 400);
        const result = await readAdminBranchDetail(createSupabaseAdminClient(), id, branchId);
        if (!result.ok) {
            return result.error === 'not_found'
                ? createErrorResponse('not_found', 'Филиал не найден', undefined, 404)
                : loadFailed('AdminBranchDetail', result);
        }
        return NextResponse.json(result);
    });
}

export function runAdminBusinessApplicationsHttp() {
    return withErrorHandler('AdminBusinessApplications', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        const result = await readAdminBusinessApplications(createSupabaseAdminClient());
        if (!result.ok) return loadFailed('AdminBusinessApplications', result);
        return NextResponse.json(result);
    });
}

export function runAdminUserDetailHttp(context: unknown) {
    return withErrorHandler('AdminUserDetail', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        const id = await uuidParam(context, 'id');
        if (!id) return createErrorResponse('validation', 'Неверный идентификатор пользователя', undefined, 400);
        const result = await readAdminUserDetail(createSupabaseAdminClient(), access.user.id, id);
        if (!result.ok) {
            return result.error === 'not_found'
                ? createErrorResponse('not_found', 'Пользователь не найден', undefined, 404)
                : loadFailed('AdminUserDetail', result);
        }
        return NextResponse.json(result);
    });
}

export function runAdminUserStatsHttp() {
    return withErrorHandler('AdminUserStats', async () => {
        const access = await requireCurrentSuperAdmin();
        if (!access.ok) return access.response;
        try {
            const stats = await readAdminUserStats(createSupabaseAdminClient(), access.user.id);
            return NextResponse.json({ ok: true, stats });
        } catch {
            return loadFailed('AdminUserStats', null);
        }
    });
}
