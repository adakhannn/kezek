import { NextResponse } from 'next/server';

import {
    createErrorResponse,
    createSuccessResponse,
} from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { runBranchDeleteRoute } from '@/lib/branchDeleteRouteService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

export async function runBranchDeleteHttp(context: unknown): Promise<NextResponse> {
    const branchId = await getRouteParamUuid(context, 'id');
    const { supabase, bizId } = await getBizContextForManagers();

    const result = await runBranchDeleteRoute({
        supabase,
        admin: getServiceClient(),
        branchId,
        bizId,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse();
}
