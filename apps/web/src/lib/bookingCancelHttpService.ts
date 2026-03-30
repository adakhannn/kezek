import { NextResponse } from 'next/server';

import {
    createErrorResponse,
    createSuccessResponse,
} from '@/lib/apiErrorHandler';
import { runBookingCancelRoute } from '@/lib/bookingCancelRouteService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function runBookingCancelHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const bookingId = await getRouteParamUuid(context, 'id');
    const supabase = await createSupabaseServerClient();

    const result = await runBookingCancelRoute({
        supabase,
        bookingId,
        requestUrl: req.url,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse();
}
