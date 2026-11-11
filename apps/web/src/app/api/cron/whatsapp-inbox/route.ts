import { NextResponse } from 'next/server';

import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { getWhatsAppPhoneNumberId } from '@/lib/env';
import { createOutboxAdminClient } from '@/lib/notifications/outboxStore';
import { sendOutboxDelivery } from '@/lib/notifications/outboxTransport';
import { createWhatsAppInboxStore } from '@/lib/whatsappInbox/store';
import { runWhatsAppInboxWorker } from '@/lib/whatsappInbox/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
    if (!isAuthorizedCronRequest(req, process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET)) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    if (process.env.WHATSAPP_INBOX_WORKER_ENABLED !== 'true') return NextResponse.json({ ok: true, enabled: false });
    return trackCronExecution('whatsapp-inbox', async () => {
        try {
            const receiver = getWhatsAppPhoneNumberId();
            if (!/^\d{1,32}$/.test(receiver)) throw new Error('INBOX_RECEIVER_NOT_CONFIGURED');
            const result = await runWhatsAppInboxWorker({ store: createWhatsAppInboxStore(createOutboxAdminClient()), receiver, send: sendOutboxDelivery });
            const ok = result.errors === 0 && result.failed === 0;
            return NextResponse.json({ ok, enabled: true, ...result }, { status: ok ? 200 : 503 });
        } catch {
            return NextResponse.json({ ok: false, error: 'inbox_worker_failed' }, { status: 503 });
        }
    });
}
