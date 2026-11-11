import { validateCreateGuestBookingParams } from '@core-domain/booking';
import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { readBookingRequestIdentity } from '@/lib/bookingRequestHttp';
import {
    type QuickBookGuestInput,
    type QuickBookGuestSupabasePort,
    runQuickBookGuest,
} from '@/lib/quickBookGuestService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { validateRequest } from '@/lib/validation/apiValidation';
import { quickBookGuestSchema } from '@/lib/validation/bookingSchemas';

type QuickBookGuestRequestBody = {
    biz_id: string;
    branch_id: string;
    service_id?: string;
    services?: { service_id: string; duration_min: number; order_index?: number }[];
    staff_id: string;
    start_at: string;
    client_name: string;
    client_phone: string;
    client_email?: string | null;
};

function normalizeQuickBookGuestInput(
    raw: QuickBookGuestRequestBody,
): QuickBookGuestInput | NextResponse {
    const normalized = {
        ...raw,
        service_id:
            raw.service_id ??
            (raw.services?.[0] ? raw.services[0].service_id : undefined),
    };

    const domainValidation = validateCreateGuestBookingParams(normalized);
    if (!domainValidation.valid || !domainValidation.data) {
        return createErrorResponse(
            'validation',
            domainValidation.error || 'Invalid guest booking params',
            undefined,
            400,
        );
    }

    return domainValidation.data;
}

export async function runQuickBookGuestHttp(req: Request): Promise<NextResponse> {
    const identity = readBookingRequestIdentity(req, true);
    if (identity instanceof NextResponse) return identity;

    const validationResult = await validateRequest(req, quickBookGuestSchema);
    if (!validationResult.success) {
        return validationResult.response;
    }

    const normalized = normalizeQuickBookGuestInput(
        validationResult.data as QuickBookGuestRequestBody,
    );
    if (normalized instanceof NextResponse) {
        return normalized;
    }

    const admin = createSupabaseAdminClient() as unknown as QuickBookGuestSupabasePort;
    const result = await runQuickBookGuest(
        {
            admin,
            identity,
        },
        normalized,
    );

    if (result instanceof NextResponse) {
        return result;
    }

    return createSuccessResponse({
        booking_id: result.bookingId,
        confirmed: result.confirmed,
    });
}
