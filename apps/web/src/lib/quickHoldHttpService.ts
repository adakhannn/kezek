import { validateCreateBookingParams } from '@core-domain/booking';
import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { readBookingRequestIdentity } from '@/lib/bookingRequestHttp';
import { runQuickHold } from '@/lib/quickHoldService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
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

export async function runQuickHoldHttp(req: Request): Promise<NextResponse> {
    const authContext = await resolveRequestAuthContext(req, 'QuickHold');
    if (authContext instanceof Response) {
        return authContext as NextResponse;
    }

    const identity = readBookingRequestIdentity(req, false);
    if (identity instanceof NextResponse) return identity;

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

    const result = await runQuickHold({ admin: createSupabaseAdminClient(), actorId: authContext.user.id, identity }, normalized);
    if (result instanceof NextResponse) return result;

    return createSuccessResponse({
        booking_id: result.bookingId,
        confirmed: true,
    });
}
