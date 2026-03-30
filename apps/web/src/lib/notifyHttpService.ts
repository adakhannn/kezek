import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runNotifyBooking } from '@/lib/notifyBookingService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { notifyRequestSchema } from '@/lib/validation/schemas';

export async function runNotifyHttp(req: Request): Promise<NextResponse> {
    const validationResult = await validateRequest(req, notifyRequestSchema);
    if (!validationResult.success) {
        return validationResult.response;
    }

    const result = await runNotifyBooking(validationResult.data);
    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}
