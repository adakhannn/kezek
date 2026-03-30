import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { runServiceUpdateFlow } from '@/lib/serviceUpdateRouteService';
import type { ServiceUpdateAdminClientLike, ServiceUpdateBody } from '@/lib/serviceUpdateRouteService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runServiceUpdateHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const serviceId = await getRouteParamRequired(context, 'id');
    const { bizId } = await getBizContextForManagers();
    const body = (await req.json().catch(() => ({} as ServiceUpdateBody))) as ServiceUpdateBody;

    const result = await runServiceUpdateFlow({
        admin: getServiceClient() as unknown as ServiceUpdateAdminClientLike,
        bizId,
        serviceId,
        body,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse();
}
