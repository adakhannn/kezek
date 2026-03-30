import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { funnelEventSchema, saveFunnelEvent } from '@/lib/funnelEventsService';
import { getServiceClient } from '@/lib/supabaseService';
import { validateBody } from '@/lib/validation/apiValidation';

export async function runFunnelEventsHttp(req: Request): Promise<NextResponse> {
    const bodyValidation = await validateBody(req, funnelEventSchema);
    if (!bodyValidation.success) {
        return bodyValidation.response;
    }

    const result = await saveFunnelEvent(getServiceClient(), bodyValidation.data);
    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse();
}
