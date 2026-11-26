import { NextResponse } from 'next/server';

import {
    createErrorResponse,
    createSuccessResponse,
} from '@/lib/apiErrorHandler';
import { runBookingCancelRoute } from '@/lib/bookingCancelRouteService';
import { managerAccessToBusiness } from '@/lib/businessManagerAccess';
import { createRequestSupabaseClient, hasBearerAuthorization } from '@/lib/requestAuthContext';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

export async function runBookingCancelHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    const bookingId = await getRouteParamUuid(context, 'id');
    // The website's cookie session, or the app's Bearer token (O1): the same rules either way.
    const bearer = hasBearerAuthorization(req);
    const supabase = await createRequestSupabaseClient(req);

    const result = await runBookingCancelRoute({
        supabase,
        bookingId,
        // The app has no "current business" cookie: a manager may cancel in any business they
        // manage (managerAccessToBusiness, the rule of the website's business chooser).
        ...(bearer ? {
            isBusinessManager: async (userId: string, bizId: string) =>
                (await managerAccessToBusiness(createSupabaseAdminClient(), userId, bizId)) === 'manager',
        } : {}),
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse();
}
