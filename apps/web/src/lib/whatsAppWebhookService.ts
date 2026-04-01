
import { logDebug, logError } from '@/lib/log';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { getServiceClient } from '@/lib/supabaseService';
import {
    runWhatsAppCancelBooking,
    runWhatsAppConfirmBooking,
} from '@/lib/whatsAppBookingActionService';
import {
    executeWhatsAppBookingCommand,
    type BookingCommandDeps,
} from '@/lib/whatsAppBookingCommandFlow';
import { routeWhatsAppTextCommand } from '@/lib/whatsAppCommandRouting';
import {
    handleIncomingWhatsAppMediaMessage,
    logWhatsAppStatusUpdate,
} from '@/lib/whatsAppMediaStatusHandlers';
import {
    resolveWhatsAppMessageContext,
    type ActiveBookingRow,
} from '@/lib/whatsAppMessageContext';
import {
    hasPersistedWhatsAppStatus,
    isWhatsAppMessageAlreadyProcessed,
    markWhatsAppMessageProcessed,
    persistIncomingWhatsAppMessage,
    type PersistenceClient,
} from '@/lib/whatsAppMessagePersistence';
import {
    buildBookingChoiceText,
    buildBookingInfoText,
    buildHelpText,
    buildRemindText,
} from '@/lib/whatsAppWebhookText';

type WhatsAppMessage = {
    from: string;
    id: string;
    type: string;
    timestamp: string;
    text?: { body: string };
    image?: { id: string; mime_type?: string; sha256?: string; caption?: string };
    audio?: { id: string; mime_type?: string; sha256?: string };
    video?: { id: string; mime_type?: string; sha256?: string; caption?: string };
    document?: { id: string; filename?: string; mime_type?: string; sha256?: string; caption?: string };
    context?: {
        from?: string;
        id?: string;
    };
    [key: string]: unknown;
};

type WhatsAppStatus = {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
};

type WhatsAppWebhookChange = {
    value?: {
        messages?: WhatsAppMessage[];
        statuses?: WhatsAppStatus[];
    };
};

type WhatsAppWebhookEntry = {
    changes?: WhatsAppWebhookChange[];
};

type WhatsAppWebhookBody = {
    object?: string;
    entry?: WhatsAppWebhookEntry[];
};

export async function processWhatsAppWebhookBody(body: unknown) {
    const payload = body as WhatsAppWebhookBody;

    if (payload?.object !== 'whatsapp_business_account') {
        return;
    }

    for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
            const value = change.value;

            if (value?.messages) {
                for (const message of value.messages) {
                    await handleIncomingMessage(message);
                }
            }

            if (value?.statuses) {
                for (const status of value.statuses) {
                    await handleStatusUpdate(status);
                }
            }
        }
    }
}
async function handleIncomingMessage(message: WhatsAppMessage) {
    try {
        const admin = getServiceClient();
        const persistenceAdmin = admin as unknown as PersistenceClient;
        const fromPhone = message.from;
        const normalizedPhone = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;
        const messageId = message.id;
        const messageType = message.type;
        const messageText = messageType === 'text' ? (message.text?.body ?? null) : null;
        const timestamp = new Date(parseInt(message.timestamp, 10) * 1000).toISOString();

        logDebug('WhatsAppWebhook', 'Processing incoming message', {
            messageId,
            fromPhone,
            type: messageType,
            hasText: !!messageText,
        });

        if (await isWhatsAppMessageAlreadyProcessed(persistenceAdmin, messageId)) {
            return;
        }

        const { clientId, activeBookings, bizId } = await resolveWhatsAppMessageContext(normalizedPhone);
        const bookingId = activeBookings[0]?.id ?? null;

        const wasSaved = await persistIncomingWhatsAppMessage(persistenceAdmin, {
            whatsapp_message_id: messageId,
            from_phone: normalizedPhone,
            message_type: messageType,
            message_text: messageText,
            message_timestamp: timestamp,
            client_id: clientId,
            booking_id: bookingId,
            biz_id: bizId,
            raw_data: message as unknown as Record<string, unknown>,
            processed: false,
        });

        if (!wasSaved) {
            return;
        }

        if (messageType !== 'text') {
            await handleIncomingWhatsAppMediaMessage(message, normalizedPhone, bookingId);
        }

        if (messageType === 'text' && messageText) {
            await handleTextCommand(messageText, normalizedPhone, activeBookings, clientId);
            await markWhatsAppMessageProcessed(persistenceAdmin, messageId);
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling incoming message', {
            error,
            message: message.id,
        });
    }
}
async function handleTextCommand(
    messageText: string,
    fromPhone: string,
    activeBookings: ActiveBookingRow[],
    clientId: string | null
) {
    try {
        const command = routeWhatsAppTextCommand(messageText, activeBookings.length);
        const bookingId =
            command.bookingIndex !== null ? activeBookings[command.bookingIndex]?.id ?? null : activeBookings[0]?.id ?? null;

        if (command.kind === 'remind') {
            await handleRemindCommand(fromPhone, activeBookings);
            return;
        }

        if (command.kind === 'cancel') {
            if (command.requiresBookingChoice) {
                await sendWhatsApp({
                    to: fromPhone,
                    text: buildBookingChoiceText('cancel', activeBookings),
                });
                return;
            }

            await handleCancelCommand(fromPhone, bookingId, clientId);
            return;
        }

        if (command.kind === 'confirm') {
            if (command.requiresBookingChoice) {
                await sendWhatsApp({
                    to: fromPhone,
                    text: buildBookingChoiceText('confirm', activeBookings),
                });
                return;
            }

            await handleConfirmCommand(fromPhone, bookingId, clientId);
            return;
        }

        if (command.kind === 'help') {
            await handleHelpCommand(fromPhone, activeBookings.length);
            return;
        }

        if (bookingId) {
            await sendBookingInfo(fromPhone, bookingId);
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling text command', { error, messageText, fromPhone });
    }
}

async function handleCancelCommand(fromPhone: string, bookingId: string | null, clientId: string | null) {
    const admin = getServiceClient();
    const bookingCommandSupabase = admin as unknown as BookingCommandDeps['supabase'];
    await executeWhatsAppBookingCommand(
        {
            supabase: bookingCommandSupabase,
            sendMessage: (text) => sendWhatsApp({ to: fromPhone, text }),
            runAction: (targetBookingId) => runWhatsAppCancelBooking({ supabase: admin }, targetBookingId),
        },
        {
            kind: 'cancel',
            fromPhone,
            bookingId,
            clientId,
        },
    );
}

async function handleConfirmCommand(fromPhone: string, bookingId: string | null, clientId: string | null) {
    const admin = getServiceClient();
    const bookingCommandSupabase = admin as unknown as BookingCommandDeps['supabase'];
    await executeWhatsAppBookingCommand(
        {
            supabase: bookingCommandSupabase,
            sendMessage: (text) => sendWhatsApp({ to: fromPhone, text }),
            runAction: (targetBookingId) => runWhatsAppConfirmBooking({ supabase: admin }, targetBookingId),
        },
        {
            kind: 'confirm',
            fromPhone,
            bookingId,
            clientId,
        },
    );
}

async function handleRemindCommand(fromPhone: string, activeBookings: ActiveBookingRow[]) {
    try {
        if (activeBookings.length === 0) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'РЈ РІР°СЃ РЅРµС‚ РїСЂРµРґСЃС‚РѕСЏС‰РёС… Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№.',
            });
            return;
        }

        await sendWhatsApp({
            to: fromPhone,
            text: buildRemindText(activeBookings),
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Failed to send remind message', { error, fromPhone });
    }
}

async function handleHelpCommand(fromPhone: string, activeBookingsCount: number) {
    try {
        await sendWhatsApp({
            to: fromPhone,
            text: buildHelpText(activeBookingsCount),
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Failed to send help message', { error, fromPhone });
    }
}

async function sendBookingInfo(fromPhone: string, bookingId: string) {
    try {
        const admin = getServiceClient();
        const { data: booking } = await admin
            .from('bookings')
            .select(`
                id, status, start_at, end_at,
                services(name_ru),
                staff(full_name),
                branches(name, address),
                businesses(name)
            `)
            .eq('id', bookingId)
            .maybeSingle();

        if (!booking) {
            return;
        }

        await sendWhatsApp({
            to: fromPhone,
            text: buildBookingInfoText(booking),
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Failed to send booking info', { error, bookingId, fromPhone });
    }
}

async function handleStatusUpdate(status: WhatsAppStatus) {
    try {
        const admin = getServiceClient();
        const persistenceAdmin = admin as unknown as PersistenceClient;

        if (!(await hasPersistedWhatsAppStatus(persistenceAdmin, status.id))) {
            return;
        }

        logWhatsAppStatusUpdate(status);
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling status update', { error, statusId: status.id });
    }
}
