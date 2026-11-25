import { getWhatsAppPhoneNumberId } from '@/lib/env';
import { createOutboxAdminClient } from '@/lib/notifications/outboxStore';
import { parseWhatsAppDeliveryFailures, parseWhatsAppInboxBody } from '@/lib/whatsappInbox/parse';
import { createWhatsAppInboxStore } from '@/lib/whatsappInbox/store';

/** Receive only. Commands and replies are executed by the separately enabled durable worker. */
export async function processWhatsAppWebhookBody(body: unknown): Promise<void> {
    const receiver = getWhatsAppPhoneNumberId();
    if (!/^\d{1,32}$/.test(receiver)) throw new Error('INBOX_RECEIVER_NOT_CONFIGURED');
    const messages = parseWhatsAppInboxBody(body, receiver);
    const failures = parseWhatsAppDeliveryFailures(body, receiver);
    if (!messages.length && !failures.length) return;
    const admin = createOutboxAdminClient();
    if (messages.length) await createWhatsAppInboxStore(admin).receive(receiver, messages);
    // A failed status marks the matching booking outbox receipt failed (R25-07). Idempotent: a
    // database error answers 503 and Meta redelivers the callback.
    if (failures.length) {
        const { error } = await admin.rpc('record_booking_notification_provider_failures', { p_failures: failures })
            .abortSignal(AbortSignal.timeout(5000));
        if (error) throw new Error('WHATSAPP_DELIVERY_FAILURE_NOT_RECORDED');
    }
}
