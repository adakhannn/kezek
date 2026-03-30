import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { runServiceDeleteRoute } from '@/lib/serviceDeleteRouteService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runServiceDeleteHttp(
    context: unknown,
): Promise<NextResponse> {
    const serviceId = await getRouteParamRequired(context, 'id');
    const { bizId } = await getBizContextForManagers();
    const admin = getServiceClient();

    const result = await runServiceDeleteRoute({
        admin,
        bizId,
        serviceId,
    });

    if (!result.ok) {
        return createErrorResponse(
            result.error,
            result.message,
            result.details,
            result.status,
        );
    }

    return createSuccessResponse();
}
