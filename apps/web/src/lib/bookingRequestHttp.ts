import { createErrorResponse } from '@/lib/apiErrorHandler';

export type BookingRequestIdentity = { requestId: string; guestSecret?: string };

/** Request identity is mandatory: generating it on the server makes retries unsafe. */
export function readBookingRequestIdentity(req: Request, guest: boolean) {
    const requestId = req.headers.get('Idempotency-Key');
    const guestSecret = req.headers.get('X-Booking-Client-Token');
    if (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
        (guest && (!guestSecret || !/^[a-f0-9]{64}$/.test(guestSecret)))) {
        return createErrorResponse('validation', 'A valid booking request identity is required', undefined, 400);
    }
    return { requestId, ...(guest ? { guestSecret: guestSecret! } : {}) } satisfies BookingRequestIdentity;
}
