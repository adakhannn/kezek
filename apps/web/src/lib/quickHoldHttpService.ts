import { type BookingError, type CreateBookingResult, validateCreateBookingParams } from '@core-domain/booking';
import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { dispatchBookingNotification } from '@/lib/bookingNotificationDispatch';
import { BookingSlotConflictError } from '@/lib/bookingSlotConflict';
import { runQuickHold } from '@/lib/quickHoldService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { validateRequest } from '@/lib/validation/apiValidation';
import { quickHoldSchema } from '@/lib/validation/bookingSchemas';

type QuickHoldRequestBody = {
    biz_id: string;
    branch_id?: string;
    service_id?: string;
    services?: { service_id: string; duration_min: number; order_index?: number }[];
    staff_id: string;
    start_at: string;
};

function normalizeQuickHoldInput(raw: QuickHoldRequestBody) {
    const normalized = {
        ...raw,
        service_id:
            raw.service_id ??
            (raw.services?.[0] ? raw.services[0].service_id : undefined),
    };

    const domainValidation = validateCreateBookingParams(normalized);
    if (!domainValidation.valid || !domainValidation.data) {
        return createErrorResponse(
            'validation',
            domainValidation.error || 'Неверные параметры бронирования',
            undefined,
            400,
        );
    }

    return domainValidation.data;
}

function mapQuickHoldError(error: BookingError) {
    const kind = error.kind;
    const baseMessage =
        kind === 'BRANCH_NOT_FOUND_OR_INACTIVE'
            ? 'Филиал не найден или неактивен'
            : kind === 'NO_ACTIVE_BRANCH_FOR_BIZ'
              ? 'Для выбранного бизнеса нет активных филиалов'
              : 'Не удалось создать бронирование';

    return createErrorResponse(
        'validation',
        error.message || baseMessage,
        { kind },
        400,
    );
}

export async function runQuickHoldHttp(req: Request): Promise<NextResponse> {
    const authContext = await resolveRequestAuthContext(req, 'QuickHold');
    if (authContext instanceof Response) {
        return authContext as NextResponse;
    }

    const validationResult = await validateRequest(req, quickHoldSchema);
    if (!validationResult.success) {
        return validationResult.response;
    }

    const normalized = normalizeQuickHoldInput(
        validationResult.data as QuickHoldRequestBody,
    );
    if (normalized instanceof Response) {
        return normalized as NextResponse;
    }

    let result: CreateBookingResult;
    try {
        result = await runQuickHold(
            {
                supabase: authContext.supabase,
                userId: authContext.user.id,
                notify: ({ bookingId, type }) => dispatchBookingNotification(authContext.supabase, bookingId, type),
            },
            normalized,
        );
    } catch (error) {
        if (error instanceof BookingSlotConflictError) {
            return createErrorResponse('booking_slot_unavailable', error.message, undefined, 409);
        }
        throw error;
    }

    if (!result.ok) {
        return mapQuickHoldError(result.error);
    }

    return createSuccessResponse({
        booking_id: result.bookingId,
        confirmed: true,
    });
}
