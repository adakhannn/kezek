import { createErrorResponse } from '@/lib/apiErrorHandler';
import type { BookingRequestIdentity } from '@/lib/bookingRequestHttp';
import { bookingCommandError, BookingSlotConflictError } from '@/lib/bookingSlotConflict';

type BookingRpcResult = { data: unknown; error: { message: string; code?: string } | null };
export type BookingRequestSupabasePort = {
    rpc: (name: string, args: Record<string, unknown>) => {
        abortSignal: (signal: AbortSignal) => PromiseLike<BookingRpcResult>;
    };
};
const BOOKING_COMMAND_DEADLINE_MS = 10_000;

export async function createConfirmedBooking(
    supabase: BookingRequestSupabasePort,
    identity: BookingRequestIdentity,
    input: object,
    actorId: string | null,
) {
    return executeBookingCommand(supabase, 'create_confirmed_booking', {
        p_request_id: identity.requestId, p_payload: input,
        p_guest_secret: identity.guestSecret ?? null, p_actor_id: actorId,
    });
}

export async function createInternalBookingRequest(
    supabase: BookingRequestSupabasePort, identity: BookingRequestIdentity, input: object, actorId: string,
) {
    return executeBookingCommand(supabase, 'create_internal_booking_request', {
        p_request_id: identity.requestId, p_payload: input, p_actor_id: actorId,
    });
}

async function executeBookingCommand(supabase: BookingRequestSupabasePort, name: string, args: Record<string, unknown>) {
    // Never log the payload or guest proof, including PostgREST error details.
    let result: BookingRpcResult;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const controller = new AbortController();
        const deadline = new Promise<BookingRpcResult>((_resolve, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error('BOOKING_COMMAND_TIMEOUT')); }, BOOKING_COMMAND_DEADLINE_MS);
        });
        const pending = supabase.rpc(name, args).abortSignal(controller.signal);
        result = await Promise.race([pending, deadline]);
    } catch {
        // The transaction may have committed before the transport failed. Only
        // the same request identity can resolve that uncertainty safely.
        return createErrorResponse('service_unavailable', 'Booking result is unavailable. Retry the same request.', undefined, 503);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
    const { data, error } = result;
    if (error) {
        if (error.message === 'BOOKING_REQUEST_CONFLICT') {
            return createErrorResponse('booking_request_conflict', 'This request belongs to another booking attempt', undefined, 409);
        }
        if (bookingCommandError(error) instanceof BookingSlotConflictError) {
            return createErrorResponse('booking_slot_unavailable', 'The selected time is no longer available', undefined, 409);
        }
        if (error.message === 'BOOKING_AUTH_REQUIRED') {
            return createErrorResponse('auth', 'Not signed in', undefined, 401);
        }
        if (error.message === 'BOOKING_FORBIDDEN') {
            return createErrorResponse('forbidden', 'Нет доступа к созданию записи для этого сотрудника или филиала', undefined, 403);
        }
        const validationMessages = [
            'INVALID_BOOKING_REQUEST', 'NO_ACTIVE_BRANCH_FOR_BIZ', 'branch not found or inactive',
            'staff not found or inactive', 'service not found or inactive', 'SCHEDULE_OUTSIDE_WORKING_HOURS', 'booking is outside effective schedule',
            'client_name is required', 'client_phone is required', 'User profile not found',
        ];
        if (validationMessages.includes(error.message) || error.code?.startsWith('22') || error.code === '23503') {
            return createErrorResponse('validation', 'The booking parameters are no longer valid', undefined, 400);
        }
        return createErrorResponse('service_unavailable', 'Booking could not be confirmed. Retry the same request.', undefined, 503);
    }
    if (!data || typeof data !== 'object' || !('booking_id' in data) ||
        typeof data.booking_id !== 'string' || !('confirmed' in data) || data.confirmed !== true) {
        return createErrorResponse('service_unavailable', 'Booking result is unavailable. Retry the same request.', undefined, 503);
    }
    return { bookingId: data.booking_id, confirmed: true as const };
}
