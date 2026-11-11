import type { CreateBookingParams } from '@core-domain/booking';

import type { BookingRequestIdentity } from '@/lib/bookingRequestHttp';
import { createConfirmedBooking, type BookingRequestSupabasePort } from '@/lib/bookingRequestService';

export async function runQuickHold(
    deps: { admin: BookingRequestSupabasePort; actorId: string; identity: BookingRequestIdentity },
    input: CreateBookingParams,
) {
    // Only the HTTP auth boundary supplies actorId after auth.getUser(). The
    // service-only RPC cannot be reached with a browser/anonymous Supabase key.
    return createConfirmedBooking(deps.admin, deps.identity, input, deps.actorId);
}
