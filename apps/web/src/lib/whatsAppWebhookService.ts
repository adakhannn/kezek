import { formatInTimeZone } from 'date-fns-tz';

import { logDebug, logError, logWarn } from '@/lib/log';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';
import {
    runWhatsAppCancelBooking,
    runWhatsAppConfirmBooking,
} from '@/lib/whatsAppBookingActionService';

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

type ActiveBookingRow = {
    id: string;
    biz_id: string;
    start_at: string;
    services: { name_ru?: string }[] | { name_ru?: string } | null;
    staff: { full_name?: string }[] | { full_name?: string } | null;
    client_id?: string | null;
    client_phone?: string | null;
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

type MessageContext = {
    clientId: string | null;
    activeBookings: ActiveBookingRow[];
    bizId: string | null;
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

function formatFirstValue<T extends { name_ru?: string; full_name?: string; name?: string; address?: string | null }>(
    value: T[] | T | null | undefined,
    key: keyof T,
    fallback: string
): string {
    if (Array.isArray(value)) {
        const first = value[0];
        return (first?.[key] as string | undefined) || fallback;
    }

    return (value?.[key] as string | undefined) || fallback;
}

function formatBookingListLine(booking: ActiveBookingRow, index: number): string {
    const serviceName = formatFirstValue(booking.services, 'name_ru', 'услуга');
    const staffName = formatFirstValue(booking.staff, 'full_name', 'мастер');
    const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');

    return `${index}. ${startTime} - ${serviceName}, ${staffName}`;
}

async function resolveMessageContext(normalizedPhone: string): Promise<MessageContext> {
    const admin = getServiceClient();
    let clientId: string | null = null;
    let activeBookings: ActiveBookingRow[] = [];
    let bizId: string | null = null;

    const { data: profile } = await admin
        .from('profiles')
        .select('id, phone')
        .eq('phone', normalizedPhone)
        .maybeSingle();

    if (profile) {
        clientId = profile.id;
        logDebug('WhatsAppWebhook', 'Found client by phone', { clientId, phone: normalizedPhone });

        const { data: clientBookings } = await admin
            .from('bookings')
            .select('id, biz_id, start_at, client_id, client_phone, services(name_ru), staff(full_name)')
            .eq('client_id', clientId)
            .in('status', ['hold', 'confirmed', 'paid'])
            .gte('start_at', new Date().toISOString())
            .order('start_at', { ascending: true })
            .limit(10);

        if (clientBookings?.length) {
            activeBookings = clientBookings as unknown as ActiveBookingRow[];
            bizId = activeBookings[0].biz_id;
            logDebug('WhatsAppWebhook', 'Found active bookings', { count: activeBookings.length, bizId });
        } else {
            const { data: lastBooking } = await admin
                .from('bookings')
                .select('biz_id')
                .eq('client_id', clientId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lastBooking) {
                bizId = lastBooking.biz_id;
            }
        }

        return { clientId, activeBookings, bizId };
    }

    const { data: guestBookings } = await admin
        .from('bookings')
        .select('id, biz_id, start_at, client_id, client_phone, services(name_ru), staff(full_name)')
        .eq('client_phone', normalizedPhone)
        .in('status', ['hold', 'confirmed', 'paid'])
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(10);

    if (guestBookings?.length) {
        activeBookings = guestBookings as unknown as ActiveBookingRow[];
        bizId = activeBookings[0].biz_id;
        logDebug('WhatsAppWebhook', 'Found guest bookings by phone', { count: activeBookings.length, bizId });
    }

    return { clientId, activeBookings, bizId };
}

async function handleIncomingMessage(message: WhatsAppMessage) {
    try {
        const admin = getServiceClient();
        const fromPhone = message.from;
        const normalizedPhone = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;
        const messageId = message.id;
        const messageType = message.type;
        const messageText = messageType === 'text' ? message.text?.body : null;
        const timestamp = new Date(parseInt(message.timestamp, 10) * 1000).toISOString();

        logDebug('WhatsAppWebhook', 'Processing incoming message', {
            messageId,
            fromPhone,
            type: messageType,
            hasText: !!messageText,
        });

        const { data: existing } = await admin
            .from('whatsapp_messages')
            .select('id')
            .eq('whatsapp_message_id', messageId)
            .maybeSingle();

        if (existing) {
            logWarn('WhatsAppWebhook', 'Message already processed', { messageId });
            return;
        }

        const { clientId, activeBookings, bizId } = await resolveMessageContext(normalizedPhone);
        const bookingId = activeBookings[0]?.id ?? null;

        const { error: insertError } = await admin
            .from('whatsapp_messages')
            .insert({
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

        if (insertError) {
            logError('WhatsAppWebhook', 'Failed to save message', {
                error: insertError,
                messageId,
            });
            return;
        }

        logDebug('WhatsAppWebhook', 'Message saved successfully', {
            messageId,
            clientId,
            bookingId,
            bizId,
        });

        if (messageType !== 'text') {
            await handleMediaMessage(message, normalizedPhone, bookingId);
        }

        if (messageType === 'text' && messageText) {
            await handleTextCommand(messageText, normalizedPhone, activeBookings, clientId);
            await admin
                .from('whatsapp_messages')
                .update({ processed: true })
                .eq('whatsapp_message_id', messageId);
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling incoming message', {
            error,
            message: message.id,
        });
    }
}

async function handleMediaMessage(message: WhatsAppMessage, fromPhone: string, bookingId: string | null) {
    try {
        let mediaInfo = '';

        switch (message.type) {
            case 'image':
                mediaInfo = `Изображение${message.image?.caption ? `: ${message.image.caption}` : ''}`;
                break;
            case 'audio':
                mediaInfo = 'Аудио сообщение';
                break;
            case 'video':
                mediaInfo = `Видео${message.video?.caption ? `: ${message.video.caption}` : ''}`;
                break;
            case 'document':
                mediaInfo = `Документ: ${message.document?.filename || 'без имени'}`;
                break;
            default:
                mediaInfo = `Медиа-файл (${message.type})`;
        }

        logDebug('WhatsAppWebhook', 'Media message received', {
            type: message.type,
            fromPhone,
            bookingId,
            mediaInfo,
        });

        try {
            await sendWhatsApp({
                to: fromPhone,
                text: `Получен ${mediaInfo}. Спасибо! Мы обработаем ваше сообщение.`,
            });
        } catch (error) {
            logError('WhatsAppWebhook', 'Failed to send media confirmation', { error, fromPhone });
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling media message', { error, messageId: message.id });
    }
}

function parseBookingIndex(message: string, prefix: 'отмена' | 'подтвердить'): number | null {
    const lower = message.toLowerCase().trim();
    const regex =
        prefix === 'отмена'
            ? /отмен(?:а|ить)(?:\s+бронь)?\s*(\d+)/i
            : /подтверди(?:ть)?\s*(\d+)/i;
    const match = lower.match(regex);

    if (!match) {
        return null;
    }

    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}

async function handleTextCommand(
    messageText: string,
    fromPhone: string,
    activeBookings: ActiveBookingRow[],
    clientId: string | null
) {
    try {
        const lowerText = messageText.toLowerCase().trim();
        const bookingId = activeBookings[0]?.id ?? null;

        const remindCommands = ['напомни', 'напомни мне', 'remind', 'мои записи', 'мои брони'];
        if (remindCommands.some(command => lowerText.includes(command))) {
            await handleRemindCommand(fromPhone, activeBookings);
            return;
        }

        const cancelCommands = ['отмена', 'cancel', 'отменить', 'отменить бронь', 'отменить запись'];
        if (cancelCommands.some(command => lowerText.includes(command))) {
            const index = parseBookingIndex(messageText, 'отмена');
            const targetId =
                index && index <= activeBookings.length
                    ? activeBookings[index - 1].id
                    : activeBookings.length === 1
                      ? activeBookings[0].id
                      : activeBookings.length > 1 && !index
                        ? null
                        : activeBookings[0]?.id ?? null;

            if (activeBookings.length > 1 && !index) {
                const lines = activeBookings.map((booking, bookingIndex) => formatBookingListLine(booking, bookingIndex + 1)).join('\n');
                await sendWhatsApp({
                    to: fromPhone,
                    text: `У вас несколько бронирований:\n\n${lines}\n\nНапишите "отмена 1" или "отмена 2" для отмены нужной записи.`,
                });
                return;
            }

            await handleCancelCommand(fromPhone, targetId, clientId);
            return;
        }

        const confirmCommands = ['подтвердить', 'confirm', 'да', 'подтверждаю', 'ок', 'ok'];
        if (confirmCommands.some(command => lowerText.includes(command))) {
            const index = parseBookingIndex(messageText, 'подтвердить');
            const targetId =
                index && index <= activeBookings.length
                    ? activeBookings[index - 1].id
                    : activeBookings.length === 1
                      ? activeBookings[0].id
                      : activeBookings.length > 1 && !index
                        ? null
                        : activeBookings[0]?.id ?? null;

            if (activeBookings.length > 1 && !index) {
                const lines = activeBookings.map((booking, bookingIndex) => formatBookingListLine(booking, bookingIndex + 1)).join('\n');
                await sendWhatsApp({
                    to: fromPhone,
                    text: `У вас несколько бронирований:\n\n${lines}\n\nНапишите "подтвердить 1" или "подтвердить 2" для нужной записи.`,
                });
                return;
            }

            await handleConfirmCommand(fromPhone, targetId, clientId);
            return;
        }

        const helpCommands = ['помощь', 'help', 'команды', 'commands', 'что можно', '?'];
        if (helpCommands.some(command => lowerText.includes(command))) {
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
    if (!bookingId) {
        await sendWhatsApp({
            to: fromPhone,
            text: 'У вас нет активных бронирований для отмены.',
        });
        return;
    }

    try {
        const admin = getServiceClient();
        const { data: booking } = await admin
            .from('bookings')
            .select('id, status, start_at, client_id, client_phone, services(name_ru), staff(full_name)')
            .eq('id', bookingId)
            .maybeSingle();

        if (!booking) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Бронирование не найдено.',
            });
            return;
        }

        const belongsToSender =
            (booking.client_phone && booking.client_phone === fromPhone) ||
            (booking.client_id && clientId && booking.client_id === clientId);

        if (!belongsToSender) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование не связано с вашим номером телефона.',
            });
            return;
        }

        if (booking.status === 'cancelled') {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование уже отменено.',
            });
            return;
        }

        try {
            await runWhatsAppCancelBooking({ supabase: admin }, bookingId);
        } catch (cancelError) {
            logError('WhatsAppWebhook', 'Failed to cancel booking', { error: cancelError, bookingId });
            await sendWhatsApp({
                to: fromPhone,
                text: 'Не удалось отменить бронирование. Пожалуйста, попробуйте позже.',
            });
            return;
        }

        const serviceName = formatFirstValue(booking.services, 'name_ru', 'услуга');
        const staffName = formatFirstValue(booking.staff, 'full_name', 'мастер');
        const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');

        await sendWhatsApp({
            to: fromPhone,
            text: `Бронирование отменено.\n\nУслуга: ${serviceName}\nМастер: ${staffName}\nДата и время: ${startTime}`,
        });

        logDebug('WhatsAppWebhook', 'Booking cancelled via WhatsApp', { bookingId, fromPhone });
    } catch (error) {
        logError('WhatsAppWebhook', 'Error in cancel command', { error, bookingId, fromPhone });
        await sendWhatsApp({
            to: fromPhone,
            text: 'Произошла ошибка при отмене бронирования. Пожалуйста, попробуйте позже.',
        });
    }
}

async function handleConfirmCommand(fromPhone: string, bookingId: string | null, clientId: string | null) {
    if (!bookingId) {
        await sendWhatsApp({
            to: fromPhone,
            text: 'У вас нет активных бронирований для подтверждения.',
        });
        return;
    }

    try {
        const admin = getServiceClient();
        const { data: booking } = await admin
            .from('bookings')
            .select('id, status, start_at, client_id, client_phone, services(name_ru), staff(full_name), end_at')
            .eq('id', bookingId)
            .maybeSingle();

        if (!booking) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Бронирование не найдено.',
            });
            return;
        }

        const belongsToSender =
            (booking.client_phone && booking.client_phone === fromPhone) ||
            (booking.client_id && clientId && booking.client_id === clientId);

        if (!belongsToSender) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование не связано с вашим номером телефона.',
            });
            return;
        }

        if (booking.status === 'confirmed' || booking.status === 'paid') {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование уже подтверждено.',
            });
            return;
        }

        if (booking.status === 'cancelled') {
            await sendWhatsApp({
                to: fromPhone,
                text: 'Это бронирование уже отменено и не может быть подтверждено.',
            });
            return;
        }

        try {
            await runWhatsAppConfirmBooking({ supabase: admin }, bookingId);
        } catch (confirmError) {
            logError('WhatsAppWebhook', 'Failed to confirm booking', { error: confirmError, bookingId });
            await sendWhatsApp({
                to: fromPhone,
                text: 'Не удалось подтвердить бронирование. Пожалуйста, попробуйте позже.',
            });
            return;
        }

        const serviceName = formatFirstValue(booking.services, 'name_ru', 'услуга');
        const staffName = formatFirstValue(booking.staff, 'full_name', 'мастер');
        const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');

        await sendWhatsApp({
            to: fromPhone,
            text: `Бронирование подтверждено.\n\nУслуга: ${serviceName}\nМастер: ${staffName}\nДата и время: ${startTime}`,
        });

        logDebug('WhatsAppWebhook', 'Booking confirmed via WhatsApp', { bookingId, fromPhone });
    } catch (error) {
        logError('WhatsAppWebhook', 'Error in confirm command', { error, bookingId, fromPhone });
        await sendWhatsApp({
            to: fromPhone,
            text: 'Произошла ошибка при подтверждении бронирования. Пожалуйста, попробуйте позже.',
        });
    }
}

async function handleRemindCommand(fromPhone: string, activeBookings: ActiveBookingRow[]) {
    try {
        if (activeBookings.length === 0) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'У вас нет предстоящих бронирований.',
            });
            return;
        }

        const lines = activeBookings.map((booking, bookingIndex) => formatBookingListLine(booking, bookingIndex + 1)).join('\n');
        const header =
            activeBookings.length === 1
                ? 'Ваше ближайшее бронирование:\n\n'
                : `У вас ${activeBookings.length} предстоящих бронирований:\n\n`;

        await sendWhatsApp({
            to: fromPhone,
            text: `${header}${lines}\n\nКоманды: "отмена 1", "подтвердить 1", "помощь".`,
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Failed to send remind message', { error, fromPhone });
    }
}

async function handleHelpCommand(fromPhone: string, activeBookingsCount: number) {
    let helpText = 'Доступные команды:\n\n';
    helpText += '• "отмена" - отменить бронирование';
    if (activeBookingsCount > 1) {
        helpText += ' (или "отмена 1", "отмена 2")';
    }
    helpText += '\n';
    helpText += '• "подтвердить" - подтвердить бронирование';
    if (activeBookingsCount > 1) {
        helpText += ' (или "подтвердить 1", "подтвердить 2")';
    }
    helpText += '\n';
    helpText += '• "напомни" - показать предстоящие записи\n';
    helpText += '• "помощь" - это сообщение\n\n';
    helpText +=
        activeBookingsCount > 0
            ? 'У вас есть активное бронирование. Используйте команды выше для управления им.'
            : 'Для новой записи воспользуйтесь сайтом или свяжитесь с нами.';

    try {
        await sendWhatsApp({
            to: fromPhone,
            text: helpText,
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

        const serviceName = formatFirstValue(booking.services, 'name_ru', 'услуга');
        const staffName = formatFirstValue(booking.staff, 'full_name', 'мастер');
        const branchName = formatFirstValue(booking.branches, 'name', 'филиал');
        const branchAddress = formatFirstValue(booking.branches, 'address', '');
        const businessName = formatFirstValue(booking.businesses, 'name', '');
        const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');
        const endTime = formatInTimeZone(new Date(booking.end_at), TZ, 'HH:mm');

        let statusText = '';
        switch (booking.status) {
            case 'hold':
                statusText = 'Ожидает подтверждения';
                break;
            case 'confirmed':
                statusText = 'Подтверждено';
                break;
            case 'paid':
                statusText = 'Оплачено';
                break;
            case 'cancelled':
                statusText = 'Отменено';
                break;
            default:
                statusText = booking.status;
        }

        const infoText =
            `Ваше бронирование:\n\n${statusText}\n\n` +
            `Услуга: ${serviceName}\n` +
            `Мастер: ${staffName}\n` +
            `Дата и время: ${startTime} - ${endTime}\n` +
            `Филиал: ${branchName}` +
            `${branchAddress ? `\nАдрес: ${branchAddress}` : ''}` +
            `${businessName ? `\n\n${businessName}` : ''}` +
            '\n\nКоманды: "отмена", "подтвердить", "помощь"';

        await sendWhatsApp({
            to: fromPhone,
            text: infoText,
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Failed to send booking info', { error, bookingId, fromPhone });
    }
}

async function handleStatusUpdate(status: WhatsAppStatus) {
    try {
        const admin = getServiceClient();
        const { data: message } = await admin
            .from('whatsapp_messages')
            .select('id, whatsapp_message_id')
            .eq('whatsapp_message_id', status.id)
            .maybeSingle();

        if (!message) {
            return;
        }

        logDebug('WhatsAppWebhook', 'Message status updated', {
            messageId: status.id,
            status: status.status,
            recipientId: status.recipient_id,
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling status update', { error, statusId: status.id });
    }
}
