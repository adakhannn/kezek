import { validateCreateGuestBookingParams } from '@core-domain/booking';
import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError } from '@/lib/log';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';
import {
    type QuickBookGuestInput,
    type QuickBookGuestSupabasePort,
    runQuickBookGuest,
} from '@/lib/quickBookGuestService';
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

async function notifyGuestBooking(
    bookingId: string,
    req: Request,
    type: 'hold' | 'confirm' = 'hold',
) {
    const notifyUrl = new URL('/api/notify', req.url);

    logDebug('QuickBookGuest', 'Calling notify API', {
        url: notifyUrl.toString(),
        type,
        bookingId,
    });

    const response = await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, booking_id: bookingId }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logError('QuickBookGuest', 'Notify API error', {
            status: response.status,
            errorText,
        });
        return;
    }

    const result = await response.json().catch(() => ({}));
    logDebug('QuickBookGuest', 'Notify API success', result);
}

export async function runQuickBookGuestHttp(req: Request): Promise<NextResponse> {
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

    const supabase = createSupabaseAnonClient() as unknown as QuickBookGuestSupabasePort;
    const result = await runQuickBookGuest(
        {
            supabase,
            notifyGuestBooking: async ({ bookingId, type }) =>
                notifyGuestBooking(bookingId, req, type),
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
