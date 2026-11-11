import { getWhatsAppPhoneNumberId } from '@/lib/env';
import { createOutboxAdminClient } from '@/lib/notifications/outboxStore';
import { parseWhatsAppInboxBody } from '@/lib/whatsappInbox/parse';
import { createWhatsAppInboxStore } from '@/lib/whatsappInbox/store';

/** Receive only. Commands and replies are executed by the separately enabled durable worker. */
export async function processWhatsAppWebhookBody(body: unknown): Promise<void> {
    const receiver = getWhatsAppPhoneNumberId();
    if (!/^\d{1,32}$/.test(receiver)) throw new Error('INBOX_RECEIVER_NOT_CONFIGURED');
    const messages = parseWhatsAppInboxBody(body, receiver);
    if (!messages.length) return;
    await createWhatsAppInboxStore(createOutboxAdminClient()).receive(receiver, messages);
}
