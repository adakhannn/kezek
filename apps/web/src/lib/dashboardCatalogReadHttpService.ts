import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import {
    loadBranchesOverview,
    loadBranchForEdit,
    loadBusinessSettings,
    loadServiceForEdit,
    loadServicesOverview,
} from '@/lib/dashboardCatalogReadService';
import { getRouteParamRequired, getRouteParamUuid } from '@/lib/routeParams';
import { isBusinessOwner } from '@/lib/staffApplicationApprovalService';
import { getServiceClient } from '@/lib/supabaseService';

/**
 * JSON reads of the dashboard's services, branches and settings pages for the mobile app. Each one
 * acts on the caller's current business, with the page's own access rule.
 */

type Outcome<T> = { ok: true; data: T } | { ok: false; error: string; message: string; status: number; details?: unknown };

function respond<T>(result: Outcome<T>): NextResponse {
    if (!result.ok) return createErrorResponse(result.error, result.message, result.details, result.status);
    return createSuccessResponse(result.data);
}

/** GET /api/dashboard/services?branch=<id> */
export async function runServicesOverviewHttp(req: Request): Promise<NextResponse> {
    const { supabase, bizId, business } = await getBizContextForManagers();
    const branchFilter = new URL(req.url).searchParams.get('branch') ?? '';
    return respond(await loadServicesOverview({ supabase, bizId, business, branchFilter }));
}

/** GET /api/dashboard/services/[id] */
export async function runServiceForEditHttp(context: unknown): Promise<NextResponse> {
    const serviceId = await getRouteParamRequired(context, 'id');
    const { bizId } = await getBizContextForManagers();
    return respond(await loadServiceForEdit({ admin: getServiceClient(), bizId, serviceId }));
}

/** GET /api/dashboard/branches */
export async function runBranchesOverviewHttp(): Promise<NextResponse> {
    const { supabase, userId, bizId, business } = await getBizContextForManagers();
    return respond(await loadBranchesOverview({ supabase, userId, bizId, business }));
}

/** GET /api/dashboard/branches/[branchId] */
export async function runBranchForEditHttp(context: unknown): Promise<NextResponse> {
    const branchId = await getRouteParamUuid(context, 'branchId');
    const { supabase, bizId } = await getBizContextForManagers();
    return respond(await loadBranchForEdit({ supabase, bizId, branchId }));
}

/** GET /api/dashboard/contact-settings: owner or super admin, as the settings page. */
export async function runBusinessSettingsReadHttp(): Promise<NextResponse> {
    const { supabase, userId, bizId } = await getBizContextForManagers();
    const admin = getServiceClient();
    const [{ data: isSuper }, owner] = await Promise.all([
        supabase.rpc('is_super_admin'),
        isBusinessOwner({ admin, userId, bizId }),
    ]);
    if (!isSuper && !owner) {
        return createErrorResponse('forbidden', 'Только владелец бизнеса может изменять публичные контакты', undefined, 403);
    }
    return respond(await loadBusinessSettings({ admin, bizId }));
}
