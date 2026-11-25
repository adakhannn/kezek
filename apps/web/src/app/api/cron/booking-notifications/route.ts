import { NextResponse } from 'next/server';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { logError } from '@/lib/log';
import { planBookingNotifications } from '@/lib/notifications/BookingNotificationPlanner';
import { createOutboxAdminClient, createOutboxStore } from '@/lib/notifications/outboxStore';
import { sendOutboxDelivery } from '@/lib/notifications/outboxTransport';
import { runBookingNotificationWorker } from '@/lib/notifications/outboxWorker';
import { removeInvalidPushToken } from '@/lib/pushTokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
    if (!isAuthorizedCronRequest(req, process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET)) {
        return createErrorResponse('unauthorized', undefined, undefined, 401);
    }
    // Activation follows schema rollout and explicit deployment configuration.
    if (process.env.BOOKING_NOTIFICATION_WORKER_ENABLED !== 'true') {
        return NextResponse.json({ ok: true, enabled: false });
    }

    return trackCronExecution('booking-notifications', async () => {
    try {
        const admin = createOutboxAdminClient();
        const result = await runBookingNotificationWorker({ store: createOutboxStore(admin),
            plan: (booking, type) => planBookingNotifications(admin, booking, type),
            // Expo DeviceNotRegistered: the install is gone, its token is deleted.
            send: (eventId, delivery) => sendOutboxDelivery(eventId, delivery, fetch, { removePushToken: token => removeInvalidPushToken(admin, token) }) });
        // R25-13: an event that ended in worker_incomplete is a failed run for cron tracking,
        // like the WhatsApp inbox worker; per-event causes are already logged by the worker.
        const ok = result.errors === 0;
        if (!ok) logError('BookingNotificationsCron', 'Outbox worker finished with errors', { claimed: result.claimed, errors: result.errors });
        return NextResponse.json({ ok, enabled: true, ...result }, { status: ok ? 200 : 503 });
    } catch (error) {
        logError('BookingNotificationsCron', 'Outbox worker failed', error);
        return NextResponse.json({ ok: false, error: 'outbox_worker_failed' }, { status: 503 });
    }
    });
}
