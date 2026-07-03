import { z } from 'zod';

import { logDebug, logError } from '@/lib/log';

export const funnelEventSchema = z.object({
    event_type: z.enum([
        'business_view',
        'branch_select',
        'service_select',
        'staff_select',
        'slot_select',
        'booking_success',
        'booking_abandon',
    ]),
    source: z.enum(['public', 'quickdesk']),
    biz_id: z.string().uuid(),
    branch_id: z.string().uuid().nullable().optional(),
    service_id: z.string().uuid().nullable().optional(),
    service_ids: z.array(z.string().uuid()).optional(),
    services_count: z.number().int().min(0).optional(),
    staff_id: z.string().uuid().nullable().optional(),
    slot_start_at: z.string().nullable().optional(),
    booking_id: z.string().uuid().nullable().optional(),
    session_id: z.string().min(1).max(255),
    user_agent: z.string().max(500).nullable().optional(),
    referrer: z.string().max(500).nullable().optional(),
    timestamp: z.string().datetime(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type FunnelEventInput = z.infer<typeof funnelEventSchema>;

export type FunnelEventsAdminLike = {
    from: (table: 'funnel_events') => {
        insert: (payload: Record<string, unknown>) => PromiseLike<{
            error: { message: string } | null;
        }>;
    };
};

export type FunnelEventsResult =
    | { ok: true }
    | { ok: false; error: 'internal'; message: string; status: 500 };

export async function saveFunnelEvent(
    admin: FunnelEventsAdminLike,
    event: FunnelEventInput,
): Promise<FunnelEventsResult> {
    const metadata = {
        ...(event.metadata ?? {}),
        ...(event.service_ids ? { service_ids: event.service_ids } : {}),
        ...(typeof event.services_count === 'number' ? { services_count: event.services_count } : {}),
    };

    const { error } = await admin.from('funnel_events').insert({
        event_type: event.event_type,
        source: event.source,
        biz_id: event.biz_id,
        branch_id: event.branch_id || null,
        service_id: event.service_id || null,
        staff_id: event.staff_id || null,
        slot_start_at: event.slot_start_at || null,
        booking_id: event.booking_id || null,
        session_id: event.session_id,
        user_agent: event.user_agent || null,
        referrer: event.referrer || null,
        created_at: event.timestamp,
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });

    if (error) {
        logError('FunnelEventsAPI', 'Error saving funnel event', {
            error: error.message,
            event_type: event.event_type,
        });

        return {
            ok: false,
            error: 'internal',
            message: error.message,
            status: 500,
        };
    }

    logDebug('FunnelEventsAPI', 'Funnel event saved', {
        event_type: event.event_type,
        source: event.source,
        biz_id: event.biz_id,
    });

    return { ok: true };
}
