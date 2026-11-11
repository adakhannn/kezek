import { NextResponse } from 'next/server';

import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { planBookingNotifications } from '@/lib/notifications/BookingNotificationPlanner';
import { createOutboxAdminClient, createOutboxStore } from '@/lib/notifications/outboxStore';
import { sendOutboxDelivery } from '@/lib/notifications/outboxTransport';
import { runBookingNotificationWorker } from '@/lib/notifications/outboxWorker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
    if (!isAuthorizedCronRequest(req, process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET)) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    // Activation follows schema rollout and explicit deployment configuration.
    if (process.env.BOOKING_NOTIFICATION_WORKER_ENABLED !== 'true') {
        return NextResponse.json({ ok: true, enabled: false });
    }

    return trackCronExecution('booking-notifications', async () => {
    try {
        const admin = createOutboxAdminClient();
        const result = await runBookingNotificationWorker({ store: createOutboxStore(admin),
            plan: (booking, type) => planBookingNotifications(admin, booking, type), send: sendOutboxDelivery });
        return NextResponse.json({ ok: true, enabled: true, ...result });
    } catch {
        return NextResponse.json({ ok: false, error: 'outbox_worker_failed' }, { status: 503 });
    }
    });
}
