import type {
    WhatsAppMessage,
    WhatsAppStatus,
    WhatsAppWebhookBody,
} from './whatsappWebhookTypes';

type Handlers = {
    onMessage: (message: WhatsAppMessage) => Promise<void>;
    onStatus: (status: WhatsAppStatus) => Promise<void>;
};

export async function processWhatsAppWebhookBody(
    body: WhatsAppWebhookBody,
    handlers: Handlers
) {
    if (body.object !== 'whatsapp_business_account') {
        return;
    }

    for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
            const value = change.value;

            if (value?.messages) {
                for (const message of value.messages) {
                    await handlers.onMessage(message);
                }
            }

            if (value?.statuses) {
                for (const status of value.statuses) {
                    await handlers.onStatus(status);
                }
            }
        }
    }
}
