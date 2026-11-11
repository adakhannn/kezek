import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runNotifyBooking } from '@/lib/notifyBookingService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { validateRequest } from '@/lib/validation/apiValidation';
import { notifyRequestSchema } from '@/lib/validation/schemas';

export async function runNotifyHttp(req: Request): Promise<NextResponse> {
    const auth = await resolveRequestAuthContext(req, 'Notify');
    if (auth instanceof Response) return auth as NextResponse;
    const validationResult = await validateRequest(req, notifyRequestSchema);
    if (!validationResult.success) {
        return validationResult.response;
    }

    const result = await runNotifyBooking(validationResult.data, auth.supabase);
    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}
