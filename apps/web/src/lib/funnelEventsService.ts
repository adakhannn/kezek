import { z } from 'zod';

import { logDebug, logError } from '@/lib/log';
import type { DbQueryClient } from '@/lib/supabaseTypes';
import { telemetryMetadata, telemetrySessionId } from '@/lib/telemetryIngest';

/** Closed, bounded schema (API-09); the server sets created_at. */
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
    service_ids: z.array(z.string().uuid()).max(20).optional(),
    services_count: z.number().int().min(0).max(20).optional(),
    staff_id: z.string().uuid().nullable().optional(),
    slot_start_at: z.string().datetime({ offset: true }).nullable().optional(),
    booking_id: z.string().uuid().nullable().optional(),
    session_id: telemetrySessionId,
    user_agent: z.string().max(500).nullable().optional(),
    referrer: z.string().max(500).nullable().optional(),
    // Sent by current bundles; ignored: the database time is the event time.
    timestamp: z.string().max(40).optional(),
    metadata: telemetryMetadata.nullable().optional(),
}).refine((event) => event.event_type !== 'booking_success' || Boolean(event.booking_id), {
    path: ['booking_id'],
    message: 'booking_success names the booking',
});

export type FunnelEventInput = z.infer<typeof funnelEventSchema>;

export type FunnelEventsAdminLike = DbQueryClient;

export type FunnelEventsResult =
    | { ok: true }
    | { ok: false; error: { message: string; code?: string } };

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
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
    });

    if (error) {
        logError('FunnelEventsAPI', 'Error saving funnel event', { code: error.code, error: error.message, event_type: event.event_type });
        return { ok: false, error };
    }

    logDebug('FunnelEventsAPI', 'Funnel event saved', {
        event_type: event.event_type,
        source: event.source,
        biz_id: event.biz_id,
    });

    return { ok: true };
}

/**
 * Quickdesk events come from the staff desk of a business: only a manager (owner,
 * owner/admin/manager role, platform admin) or an active master of that business may send them.
 */
export async function canRecordQuickdeskEvent(
    admin: FunnelEventsAdminLike,
    userId: string,
    bizId: string,
): Promise<'allowed' | 'forbidden' | 'unavailable'> {
    const [manager, staff] = await Promise.all([
        admin.rpc('finance_can_manage_business', { p_actor_id: userId, p_biz_id: bizId }),
        admin.from('staff').select('id').eq('user_id', userId).eq('biz_id', bizId).eq('is_active', true).limit(1),
    ]);
    if (manager.error || staff.error) return 'unavailable';
    return manager.data === true || (staff.data ?? []).length > 0 ? 'allowed' : 'forbidden';
}
