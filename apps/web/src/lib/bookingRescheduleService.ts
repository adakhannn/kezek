import type { NextResponse } from 'next/server';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import type { BookingRequestIdentity } from '@/lib/bookingRequestHttp';
import { callBookingCommand, type BookingRequestSupabasePort } from '@/lib/bookingRequestService';
import { bookingCommandError, BookingSlotConflictError } from '@/lib/bookingSlotConflict';
import { logError } from '@/lib/log';

export type BookingRescheduleInput = { bookingId: string; startAt: string };
export type BookingRescheduleResult = { bookingId: string; startAt: string; endAt: string };

type Failure = readonly [error: string, message: string, status: number];

// Messages in Russian: src/lib/serverMessages.ts answers them in the request language
// (server.booking.reschedule* dictionaries).
const TIME_UNAVAILABLE: Failure = ['validation', 'Это время недоступно для записи. Выберите другое.', 400];
const SLOT_TAKEN: Failure = ['booking_slot_unavailable', 'Это время уже занято. Выберите другое.', 409];
const UNAVAILABLE: Failure = ['service_unavailable', 'Не удалось подтвердить перенос. Повторите попытку.', 503];

/** The SQL errors of reschedule_booking_request (20261125150100) as public answers. */
const FAILURES: Readonly<Record<string, Failure>> = {
    BOOKING_REQUEST_CONFLICT: ['booking_request_conflict', 'Этот запрос уже использован для другого переноса. Обновите страницу и повторите.', 409],
    BOOKING_AUTH_REQUIRED: ['auth', 'Not signed in', 401],
    BOOKING_FORBIDDEN: ['forbidden', 'Перенести запись может только её клиент', 403],
    BOOKING_NOT_FOUND: ['not_found', 'Бронирование не найдено', 404],
    BOOKING_ALREADY_STARTED: ['booking_already_started', 'Запись уже началась. Перенести её может только организация.', 409],
    BOOKING_STATUS_NOT_RESCHEDULABLE: ['not_reschedulable', 'Перенести можно только подтверждённую запись', 409],
    BOOKING_FINANCIAL_REVERSAL_REQUIRED: ['financial_reversal_required', 'Запись оплачена, учтена в смене или использует льготу. Для переноса обратитесь в организацию.', 409],
    BOOKING_CHANGED: ['booking_changed', 'Запись изменилась. Обновите страницу и повторите.', 409],
    BUSINESS_NOT_BOOKABLE: ['business_not_bookable', 'Организация сейчас не принимает записи', 403],
    RESCHEDULE_SAME_TIME: ['validation', 'Запись уже назначена на это время', 400],
    // The explicit-schedule trigger's own overlap check.
    SCHEDULE_SLOT_TAKEN: SLOT_TAKEN,
};

function failureFor(error: { message: string; code?: string }): Failure | null {
    const known = FAILURES[error.message];
    if (known) return known;
    if (bookingCommandError(error) instanceof BookingSlotConflictError) return SLOT_TAKEN;
    // Outside the schedule, in the past, inactive staff/branch/service, a master who no longer
    // performs a service: the chosen time cannot be booked.
    if (error.message === 'SCHEDULE_OUTSIDE_WORKING_HOURS' || error.code?.startsWith('22')) return TIME_UNAVAILABLE;
    // Lock timeout or serialization: nothing committed; the same request may be retried.
    if (error.code === '55P03' || error.code === '40001') return UNAVAILABLE;
    return null;
}

function respond([code, message, status]: Failure): NextResponse {
    return createErrorResponse(code, message, undefined, status);
}

/**
 * Moves the client's own confirmed booking to another start (same staff, branch and services).
 * actorId comes only from the verified session of the HTTP boundary; the RPC is service-only.
 */
export async function rescheduleBooking(
    supabase: BookingRequestSupabasePort,
    identity: BookingRequestIdentity,
    input: BookingRescheduleInput,
    actorId: string,
): Promise<BookingRescheduleResult | NextResponse> {
    const result = await callBookingCommand(supabase, 'reschedule_booking_request', {
        p_request_id: identity.requestId,
        p_booking_id: input.bookingId,
        p_new_start: input.startAt,
        p_actor_id: actorId,
    });
    if (!result) return respond(UNAVAILABLE);
    const { data, error } = result;
    if (error) {
        const failure = failureFor(error);
        if (!failure) {
            logError('BookingReschedule', 'Reschedule command failed', { sqlState: error.code ?? null });
        }
        return respond(failure ?? UNAVAILABLE);
    }
    const response = data as { booking_id?: unknown; rescheduled?: unknown; start_at?: unknown; end_at?: unknown } | null;
    if (!response || response.rescheduled !== true || typeof response.booking_id !== 'string' ||
        typeof response.start_at !== 'string' || typeof response.end_at !== 'string') {
        return respond(UNAVAILABLE);
    }
    return { bookingId: response.booking_id, startAt: response.start_at, endAt: response.end_at };
}
