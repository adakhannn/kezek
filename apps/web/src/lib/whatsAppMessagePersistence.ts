import { logDebug, logError, logWarn } from '@/lib/log';

type WhatsAppMessageRecord = {
    whatsapp_message_id: string;
    from_phone: string;
    message_type: string;
    message_text: string | null;
    message_timestamp: string;
    client_id: string | null;
    booking_id: string | null;
    biz_id: string | null;
    raw_data: Record<string, unknown>;
    processed: boolean;
};

export type PersistenceClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                maybeSingle: () => PromiseLike<{ data: { id: string; whatsapp_message_id?: string } | null }>;
            };
        };
        insert: (payload: WhatsAppMessageRecord) => PromiseLike<{ error: unknown }>;
        update: (payload: { processed: boolean }) => {
            eq: (column: string, value: string) => PromiseLike<unknown>;
        };
    };
};

export async function isWhatsAppMessageAlreadyProcessed(
    supabase: PersistenceClient,
    messageId: string,
): Promise<boolean> {
    const { data: existing } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('whatsapp_message_id', messageId)
        .maybeSingle();

    if (existing) {
        logWarn('WhatsAppWebhook', 'Message already processed', { messageId });
        return true;
    }

    return false;
}

export async function persistIncomingWhatsAppMessage(
    supabase: PersistenceClient,
    payload: WhatsAppMessageRecord,
): Promise<boolean> {
    const { error } = await supabase.from('whatsapp_messages').insert(payload);

    if (error) {
        logError('WhatsAppWebhook', 'Failed to save message', {
            error,
            messageId: payload.whatsapp_message_id,
        });
        return false;
    }

    logDebug('WhatsAppWebhook', 'Message saved successfully', {
        messageId: payload.whatsapp_message_id,
        clientId: payload.client_id,
        bookingId: payload.booking_id,
        bizId: payload.biz_id,
    });
    return true;
}

export async function markWhatsAppMessageProcessed(
    supabase: PersistenceClient,
    messageId: string,
): Promise<void> {
    await supabase
        .from('whatsapp_messages')
        .update({ processed: true })
        .eq('whatsapp_message_id', messageId);
}

export async function hasPersistedWhatsAppStatus(
    supabase: PersistenceClient,
    messageId: string,
): Promise<boolean> {
    const { data: message } = await supabase
        .from('whatsapp_messages')
        .select('id, whatsapp_message_id')
        .eq('whatsapp_message_id', messageId)
        .maybeSingle();

    return Boolean(message);
}
