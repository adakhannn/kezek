import { NextResponse } from 'next/server';

import { createSuccessResponse } from '@/lib/apiErrorHandler';
import { readBookingRequestIdentity } from '@/lib/bookingRequestHttp';
import { createInternalBookingRequest } from '@/lib/bookingRequestService';
import { internalBookingSchema } from '@/lib/internalBookingSchema';
import { checkRateLimit, RateLimitConfigs, rateLimitDeniedResponse } from '@/lib/rateLimit';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { validateRequest } from '@/lib/validation/apiValidation';

export async function runInternalBookingHttp(req: Request) {
    const auth = await resolveRequestAuthContext(req, 'InternalBooking');
    if (auth instanceof Response) return auth;
    const identity = readBookingRequestIdentity(req, false);
    if (identity instanceof NextResponse) return identity;
    const input = await validateRequest(req, internalBookingSchema);
    if (!input.success) return input.response;
    // Only the verified user enters this budget; untrusted payload.biz_id never
    // consumes another tenant's budget. SQL checks exact target authority.
    const budget = await checkRateLimit(req, { ...RateLimitConfigs.normal, identifier: auth.user.id }, '/api/bookings/internal');
    if (!budget.success) return rateLimitDeniedResponse(budget);
    const result = await createInternalBookingRequest(createSupabaseAdminClient(), identity, input.data, auth.user.id);
    if (result instanceof Response) return result;
    return createSuccessResponse({ booking_id: result.bookingId, confirmed: true });
}
