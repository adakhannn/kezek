import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { isSupabaseServiceRoleConfigured } from '@/lib/env';
import { funnelEventSchema, saveFunnelEvent } from '@/lib/funnelEventsService';
import { logWarn } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { validateBody } from '@/lib/validation/apiValidation';

export async function runFunnelEventsHttp(req: Request): Promise<NextResponse> {
    const bodyValidation = await validateBody(req, funnelEventSchema);
    if (!bodyValidation.success) {
        return bodyValidation.response;
    }

    if (!isSupabaseServiceRoleConfigured()) {
        logWarn('FunnelEventsAPI', 'Funnel event skipped because service role key is not configured', {
            event_type: bodyValidation.data.event_type,
        });

        return createSuccessResponse({ skipped: true });
    }

    const result = await saveFunnelEvent(getServiceClient(), bodyValidation.data);
    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse();
}
