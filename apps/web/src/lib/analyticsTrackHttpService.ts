import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { resolveOptionalRequestUser } from '@/lib/requestAuthContext';
import { getServiceClient } from '@/lib/supabaseService';
import { readTelemetryJson, telemetryMetadata, telemetryReadFailure, telemetrySessionId, telemetryWriteFailure } from '@/lib/telemetryIngest';
import type { Json } from '@/types/supabase';

/**
 * Public page and booking-flow beacons only (API-09). booking_* events are written by the booking
 * trigger and sign-in metrics by the auth routes: no caller, signed in or not, may send those.
 * The server sets created_at, booking_id and the client.
 */
export const trackEventSchema = z.object({
    event_type: z.enum(['home_view', 'business_page_view', 'booking_flow_start', 'booking_flow_step']),
    biz_id: z.string().uuid().nullable().optional(),
    branch_id: z.string().uuid().nullable().optional(),
    booking_id: z.null().optional(),
    source: z.enum(['web', 'mobile']),
    session_id: z.preprocess((value) => (value === '' ? null : value), telemetrySessionId.nullable().optional()),
    metadata: telemetryMetadata.nullable().optional(),
}).superRefine((event, ctx) => {
    if (event.event_type === 'home_view' && (event.biz_id || event.branch_id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['biz_id'], message: 'home_view is not tied to a business' });
    }
    if (event.event_type !== 'home_view' && !event.biz_id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['biz_id'], message: 'biz_id is required' });
    }
});

export async function runAnalyticsTrackHttp(req: Request): Promise<NextResponse> {
    const body = await readTelemetryJson(req);
    if (!body.ok) return telemetryReadFailure(body.status);

    const parsed = trackEventSchema.safeParse(body.value);
    if (!parsed.success) {
        return createErrorResponse('validation', 'Invalid analytics event', { fields: parsed.error.issues.map((issue) => issue.path.join('.')) }, 400);
    }
    const event = parsed.data;
    const user = await resolveOptionalRequestUser(req);

    const { error } = await getServiceClient().from('analytics_events').insert({
        event_type: event.event_type,
        biz_id: event.biz_id ?? null,
        branch_id: event.branch_id ?? null,
        booking_id: null,
        client_id: user?.id ?? null,
        source: event.source,
        session_id: event.session_id ?? null,
        metadata: (event.metadata ?? {}) as NonNullable<Json>,
    });
    if (error) return telemetryWriteFailure('AnalyticsTrackEvent', error);

    return createSuccessResponse({ ok: true });
}
