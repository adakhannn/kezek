import { logDebug, logError } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

import type { WhatsAppStatus } from './whatsappWebhookTypes';

export async function handleWhatsAppStatusUpdate(status: WhatsAppStatus) {
    try {
        const admin = getServiceClient();

        const { data: message } = await admin
            .from('whatsapp_messages')
            .select('id, whatsapp_message_id')
            .eq('whatsapp_message_id', status.id)
            .maybeSingle();

        if (message) {
            logDebug('WhatsAppWebhook', 'Message status updated', {
                messageId: status.id,
                status: status.status,
                recipientId: status.recipient_id,
            });
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling status update', { error, statusId: status.id });
    }
}
