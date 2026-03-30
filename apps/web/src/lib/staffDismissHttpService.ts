import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { runStaffDismiss } from '@/lib/staffDismissService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runStaffDismissHttp(context: unknown): Promise<NextResponse> {
    const staffId = await getRouteParamRequired(context, 'id');
    const { bizId } = await getBizContextForManagers();
    const admin = getServiceClient();
    const result = await runStaffDismiss({
        admin,
        bizId,
        staffId,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse();
}
