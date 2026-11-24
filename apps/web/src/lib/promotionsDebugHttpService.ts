import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runPromotionsDebugRoute } from '@/lib/promotionsDebugRouteService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export async function runPromotionsDebugHttp(request: Request): Promise<NextResponse> {
    const result = await runPromotionsDebugRoute({
        authClient: await createSupabaseServerClient(),
        serviceClient: getServiceClient(),
        requestUrl: request.url,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}
