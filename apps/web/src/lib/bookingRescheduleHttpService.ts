import { NextResponse } from 'next/server';

import { createSuccessResponse } from '@/lib/apiErrorHandler';
import { readBookingRequestIdentity } from '@/lib/bookingRequestHttp';
import { rescheduleBooking } from '@/lib/bookingRescheduleService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { validateRequest } from '@/lib/validation/apiValidation';
import { bookingRescheduleSchema } from '@/lib/validation/bookingSchemas';

/**
 * POST /api/bookings/[id]/reschedule — the web cabinet (cookie) and the mobile app (Bearer).
 * The session gives the actor; the service-only command checks that the actor is the client.
 */
export async function runBookingRescheduleHttp(req: Request, context: unknown): Promise<NextResponse> {
    const bookingId = await getRouteParamUuid(context, 'id');
    const authContext = await resolveRequestAuthContext(req, 'BookingReschedule');
    if (authContext instanceof Response) return authContext as NextResponse;

    const identity = readBookingRequestIdentity(req, false);
    if (identity instanceof NextResponse) return identity;

    const validation = await validateRequest(req, bookingRescheduleSchema);
    if (!validation.success) return validation.response;

    const result = await rescheduleBooking(
        createSupabaseAdminClient(),
        identity,
        { bookingId, startAt: validation.data.start_at },
        authContext.user.id,
    );
    if (result instanceof NextResponse) return result;

    return createSuccessResponse({
        booking_id: result.bookingId,
        start_at: result.startAt,
        end_at: result.endAt,
        rescheduled: true,
    });
}
