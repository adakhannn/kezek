import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { isSupabaseServiceRoleConfigured } from '@/lib/env';
import { canRecordQuickdeskEvent, funnelEventSchema, saveFunnelEvent } from '@/lib/funnelEventsService';
import { logWarn } from '@/lib/log';
import { resolveOptionalRequestUser } from '@/lib/requestAuthContext';
import { getServiceClient } from '@/lib/supabaseService';
import { readTelemetryJson, telemetryReadFailure, telemetryWriteFailure } from '@/lib/telemetryIngest';

export async function runFunnelEventsHttp(req: Request): Promise<NextResponse> {
    const body = await readTelemetryJson(req);
    if (!body.ok) return telemetryReadFailure(body.status);

    const parsed = funnelEventSchema.safeParse(body.value);
    if (!parsed.success) {
        return createErrorResponse('validation', 'Invalid funnel event', { fields: parsed.error.issues.map((issue) => issue.path.join('.')) }, 400);
    }
    const event = parsed.data;

    if (!isSupabaseServiceRoleConfigured()) {
        logWarn('FunnelEventsAPI', 'Funnel event skipped because service role key is not configured', {
            event_type: event.event_type,
        });

        return createSuccessResponse({ skipped: true });
    }

    const admin = getServiceClient();
    if (event.source === 'quickdesk') {
        // Staff-desk events must come from a member of that business (API-09).
        const actor = await resolveOptionalRequestUser(req);
        const access = actor ? await canRecordQuickdeskEvent(admin, actor.id, event.biz_id) : 'forbidden';
        if (access === 'unavailable') return createErrorResponse('service_unavailable', 'Event not recorded', undefined, 503);
        if (access === 'forbidden') return createErrorResponse('forbidden', 'Quickdesk events require a member of the business', undefined, 403);
    }

    const result = await saveFunnelEvent(admin, event);
    if (!result.ok) return telemetryWriteFailure('FunnelEventsAPI', result.error);

    return createSuccessResponse();
}
