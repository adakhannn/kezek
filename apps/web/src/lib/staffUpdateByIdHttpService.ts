import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { runStaffUpdateById } from '@/lib/staffUpdateByIdService';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    branch_id: string;
    is_active: boolean;
    percent_master?: number;
    percent_salon?: number;
    hourly_rate?: number | null;
};

export async function runStaffUpdateByIdHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const staffId = await getRouteParamUuid(context, 'id');
    const { bizId, userId } = await getBizContextForManagers();
    const admin = getServiceClient();

    let body: Body;
    try {
        body = await req.json();
    } catch (error) {
        logError('StaffUpdate', 'Error parsing JSON', error);
        return createErrorResponse('validation', 'РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ JSON', undefined, 400);
    }

    const result = await runStaffUpdateById({
        admin,
        staffId,
        bizId,
        userId,
        body,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}
