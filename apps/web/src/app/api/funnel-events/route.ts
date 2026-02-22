import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logError, logDebug } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';
import { validateBody } from '@/lib/validation/apiValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const funnelEventSchema = z.object({
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
    staff_id: z.string().uuid().nullable().optional(),
    slot_start_at: z.string().nullable().optional(),
    booking_id: z.string().uuid().nullable().optional(),
    session_id: z.string().min(1).max(255),
    user_agent: z.string().max(500).nullable().optional(),
    referrer: z.string().max(500).nullable().optional(),
    timestamp: z.string().datetime(),
    metadata: z.record(z.unknown()).nullable().optional(),
});

/**
 * POST /api/funnel-events
 * Сохраняет событие воронки в базу данных
 * Не содержит PII - только анонимные идентификаторы
 */
export async function POST(req: Request) {
    try {
        const bodyValidation = validateBody(req, funnelEventSchema);
        if (!bodyValidation.success) {
            return bodyValidation.response;
        }

        const event = bodyValidation.data;
        const serviceClient = getServiceClient();

        // Вставляем событие в таблицу funnel_events
        const { error } = await serviceClient.from('funnel_events').insert({
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
            metadata: event.metadata || null,
        });

        if (error) {
            logError('FunnelEventsAPI', 'Error saving funnel event', { error: error.message, event_type: event.event_type });
            return NextResponse.json(
                { ok: false, error: error.message },
                { status: 500 }
            );
        }

        logDebug('FunnelEventsAPI', 'Funnel event saved', { 
            event_type: event.event_type,
            source: event.source,
            biz_id: event.biz_id,
        });

        return NextResponse.json({ ok: true });
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logError('FunnelEventsAPI', 'Unexpected error', { error });
        return NextResponse.json(
            { ok: false, error },
            { status: 500 }
        );
    }
}

