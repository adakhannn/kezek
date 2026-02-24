// apps/web/src/app/api/webhooks/whatsapp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { formatInTimeZone } from 'date-fns-tz';
import { NextRequest, NextResponse } from 'next/server';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getWhatsAppVerifyToken } from '@/lib/env';
import { logDebug, logError, logWarn } from '@/lib/log';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

/**
 * GET - верификация webhook от Meta
 * Meta отправляет GET запрос с параметрами hub.mode, hub.challenge, hub.verify_token
 * Нужно вернуть hub.challenge если verify_token совпадает
 */
export async function GET(req: NextRequest) {
    return withErrorHandler('WhatsAppWebhook', async () => {
        const searchParams = req.nextUrl.searchParams;
        const mode = searchParams.get('hub.mode');
        const token = searchParams.get('hub.verify_token');
        const challenge = searchParams.get('hub.challenge');

        // Проверяем, что это запрос верификации от Meta
        const WHATSAPP_VERIFY_TOKEN = getWhatsAppVerifyToken();
        if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
            // Meta ожидает challenge как plain text, а не JSON
            return new NextResponse(challenge, { status: 200 });
        }

        // Если токен не совпадает, возвращаем 403
        return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
    });
}

/**
 * POST - обработка входящих webhooks от Meta
 * Обрабатываем события: входящие сообщения, статусы доставки и т.д.
 */
export async function POST(req: NextRequest) {
    return withErrorHandler('WhatsAppWebhook', async () => {
        const body = await req.json();

        // Meta отправляет webhook в формате:
        // {
        //   "object": "whatsapp_business_account",
        //   "entry": [
        //     {
        //       "id": "...",
        //       "changes": [
        //         {
        //           "value": {
        //             "messaging_product": "whatsapp",
        //             "metadata": {...},
        //             "messages": [...], // входящие сообщения
        //             "statuses": [...]  // статусы доставки
        //           },
        //           "field": "messages"
        //         }
        //       ]
        //     }
        //   ]
        // }

        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    const value = change.value;

                    // Обработка входящих сообщений
                    if (value.messages) {
                        for (const message of value.messages) {
                            await handleIncomingMessage(message);
                        }
                    }

                    // Обработка статусов доставки
                    if (value.statuses) {
                        for (const status of value.statuses) {
                            await handleStatusUpdate(status);
                        }
                    }
                }
            }
        }

        // Всегда возвращаем 200, чтобы Meta не считал запрос неудачным
        return createSuccessResponse({ success: true });
    });
}

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
    [key: string]: unknown; // Для raw_data
};

type WhatsAppStatus = {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
};

/** Элемент списка активных бронирований (для выбора из нескольких) */
type ActiveBookingRow = {
    id: string;
    biz_id: string;
    start_at: string;
    services: { name_ru?: string }[] | { name_ru?: string } | null;
    staff: { full_name?: string }[] | { full_name?: string } | null;
    client_id?: string | null;
    client_phone?: string | null;
};

function formatBookingListLine(booking: ActiveBookingRow, index: number): string {
    const services = booking.services;
    const staff = booking.staff;
    const serviceName = Array.isArray(services) ? services[0]?.name_ru || 'услуга' : (services as { name_ru?: string })?.name_ru || 'услуга';
    const staffName = Array.isArray(staff) ? staff[0]?.full_name || 'мастер' : (staff as { full_name?: string })?.full_name || 'мастер';
    const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');
    return `${index}. ${startTime} — ${serviceName}, ${staffName}`;
}

/**
 * Обработка входящего сообщения
 */
async function handleIncomingMessage(message: WhatsAppMessage) {
    try {
        const admin = getServiceClient();
        const fromPhone = message.from;
        const messageId = message.id;
        const messageType = message.type;
        const messageText = message.type === 'text' ? message.text?.body : null;
        const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();

        logDebug('WhatsAppWebhook', 'Processing incoming message', {
            messageId,
            fromPhone,
            type: messageType,
            hasText: !!messageText,
        });

        // Проверяем, не обработали ли мы уже это сообщение
        const { data: existing } = await admin
            .from('whatsapp_messages')
            .select('id')
            .eq('whatsapp_message_id', messageId)
            .maybeSingle();

        if (existing) {
            logWarn('WhatsAppWebhook', 'Message already processed', { messageId });
            return;
        }

        // Ищем клиента по номеру телефона
        // Номер от Meta приходит в формате без +, нужно нормализовать
        const normalizedPhone = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;
        
        let clientId: string | null = null;
        let activeBookings: ActiveBookingRow[] = [];
        let bizId: string | null = null;

        // Ищем пользователя по номеру телефона в profiles
        const { data: profile } = await admin
            .from('profiles')
            .select('id, phone')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        if (profile) {
            clientId = profile.id;
            logDebug('WhatsAppWebhook', 'Found client by phone', { clientId, phone: normalizedPhone });
        }

        // Собираем до 10 активных бронирований для выбора (отмена/подтвердить/напомни)
        if (clientId) {
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
                if (lastBooking) bizId = lastBooking.biz_id;
            }
        } else {
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
        }

        const bookingId = activeBookings[0]?.id ?? null;

        // Сохраняем сообщение в БД
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

        // Обработка медиа-файлов
        if (messageType !== 'text') {
            await handleMediaMessage(message, normalizedPhone, bookingId, bizId);
        }

        // Обработка текстовых команд (передаём список активных бронирований для выбора из нескольких)
        if (messageType === 'text' && messageText) {
            await handleTextCommand(messageText, normalizedPhone, activeBookings, clientId, bizId);
            await admin
                .from('whatsapp_messages')
                .update({ processed: true })
                .eq('whatsapp_message_id', messageId);
        }
    } catch (error) {
        // Логируем ошибку, но не прерываем обработку других сообщений
        logError('WhatsAppWebhook', 'Error handling incoming message', {
            error,
            message: message.id,
        });
    }
}

/**
 * Обработка медиа-файлов (изображения, аудио, видео, документы)
 */
async function handleMediaMessage(
    message: WhatsAppMessage,
    fromPhone: string,
    bookingId: string | null,
    _bizId: string | null
) {
    try {
        const mediaType = message.type;
        let mediaInfo = '';

        switch (mediaType) {
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
                mediaInfo = `Медиа-файл (${mediaType})`;
        }

        logDebug('WhatsAppWebhook', 'Media message received', {
            type: mediaType,
            fromPhone,
            bookingId,
            mediaInfo,
        });

        // Отправляем подтверждение получения медиа-файла
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

/**
 * Парсит "отмена 1" / "подтвердить 2" — возвращает 1-based индекс или null
 */
function parseBookingIndex(message: string, prefix: 'отмена' | 'подтвердить'): number | null {
    const lower = message.toLowerCase().trim();
    const re = prefix === 'отмена'
        ? /отмен(?:а|ить)(?:\s+бронь)?\s*(\d+)/i
        : /подтверди(?:ть)?\s*(\d+)/i;
    const m = lower.match(re);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return Number.isFinite(n) && n >= 1 ? n : null;
}

/**
 * Обработка текстовых команд (поддержка одного или нескольких бронирований)
 */
async function handleTextCommand(
    messageText: string,
    fromPhone: string,
    activeBookings: ActiveBookingRow[],
    clientId: string | null,
    bizId: string | null
) {
    try {
        const lowerText = messageText.toLowerCase().trim();
        const bookingId = activeBookings[0]?.id ?? null;

        // Команды напоминания (список предстоящих бронирований)
        const remindCommands = ['напомни', 'напомни мне', 'remind', 'мои записи', 'мои брони'];
        if (remindCommands.some(cmd => lowerText.includes(cmd))) {
            await handleRemindCommand(fromPhone, activeBookings);
            return;
        }

        // Команды отмены (поддержка "отмена 1", "отмена 2" при нескольких бронях)
        const cancelCommands = ['отмена', 'cancel', 'отменить', 'отменить бронь', 'отменить запись'];
        if (cancelCommands.some(cmd => lowerText.includes(cmd))) {
            const index = parseBookingIndex(messageText, 'отмена');
            const targetId = index && index <= activeBookings.length
                ? activeBookings[index - 1].id
                : activeBookings.length === 1
                    ? activeBookings[0].id
                    : activeBookings.length > 1 && !index
                        ? null
                        : activeBookings[0]?.id ?? null;
            if (activeBookings.length > 1 && !index) {
                const lines = activeBookings.map((b, i) => formatBookingListLine(b, i + 1)).join('\n');
                await sendWhatsApp({
                    to: fromPhone,
                    text: `У вас несколько бронирований:\n\n${lines}\n\nНапишите «отмена 1» или «отмена 2» и т.д. для отмены.`,
                });
                return;
            }
            await handleCancelCommand(fromPhone, targetId, clientId, bizId);
            return;
        }

        // Команды подтверждения (поддержка "подтвердить 1", "подтвердить 2")
        const confirmCommands = ['подтвердить', 'confirm', 'да', 'подтверждаю', 'ок', 'ok'];
        if (confirmCommands.some(cmd => lowerText.includes(cmd))) {
            const index = parseBookingIndex(messageText, 'подтвердить');
            const targetId = index && index <= activeBookings.length
                ? activeBookings[index - 1].id
                : activeBookings.length === 1
                    ? activeBookings[0].id
                    : activeBookings.length > 1 && !index
                        ? null
                        : activeBookings[0]?.id ?? null;
            if (activeBookings.length > 1 && !index) {
                const lines = activeBookings.map((b, i) => formatBookingListLine(b, i + 1)).join('\n');
                await sendWhatsApp({
                    to: fromPhone,
                    text: `У вас несколько бронирований:\n\n${lines}\n\nНапишите «подтвердить 1» или «подтвердить 2» и т.д.`,
                });
                return;
            }
            await handleConfirmCommand(fromPhone, targetId, clientId, bizId);
            return;
        }

        // Команды помощи
        const helpCommands = ['помощь', 'help', 'команды', 'commands', 'что можно', '?'];
        if (helpCommands.some(cmd => lowerText.includes(cmd))) {
            await handleHelpCommand(fromPhone, activeBookings.length);
            return;
        }

        // Если команда не распознана, но есть активное бронирование — отправляем информацию о нём
        if (bookingId) {
            await sendBookingInfo(fromPhone, bookingId);
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling text command', { error, messageText, fromPhone });
    }
}

/**
 * Обработка команды отмены бронирования
 */
async function handleCancelCommand(
    fromPhone: string,
    bookingId: string | null,
    clientId: string | null,
    _bizId: string | null
) {
    if (!bookingId) {
        await sendWhatsApp({
            to: fromPhone,
            text: 'У вас нет активных бронирований для отмены.',
        });
        return;
    }

    try {
        const admin = getServiceClient();
        
        // Проверяем статус бронирования и владельца (client_id или client_phone)
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
                text: 'Это бронирование не связано с вашим номером. Используйте номер телефона, указанный при записи.',
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

        // Отменяем бронирование через RPC
        const { error: cancelError } = await admin.rpc('cancel_booking', {
            p_booking_id: bookingId,
        });

        if (cancelError) {
            logError('WhatsAppWebhook', 'Failed to cancel booking', { error: cancelError, bookingId });
            await sendWhatsApp({
                to: fromPhone,
                text: 'Не удалось отменить бронирование. Пожалуйста, попробуйте позже или свяжитесь с нами.',
            });
            return;
        }

        // Формируем сообщение об отмене
        const servicesForCancel = booking.services as
            | { name_ru?: string }[]
            | { name_ru?: string }
            | null
            | undefined;
        const staffForCancel = booking.staff as
            | { full_name?: string }[]
            | { full_name?: string }
            | null
            | undefined;

        const serviceName =
            Array.isArray(servicesForCancel)
                ? servicesForCancel[0]?.name_ru || 'услуга'
                : servicesForCancel?.name_ru || 'услуга';

        const staffName =
            Array.isArray(staffForCancel)
                ? staffForCancel[0]?.full_name || 'мастер'
                : staffForCancel?.full_name || 'мастер';
        const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');

        await sendWhatsApp({
            to: fromPhone,
            text: `✅ Бронирование отменено.\n\nУслуга: ${serviceName}\nМастер: ${staffName}\nДата и время: ${startTime}\n\nЕсли у вас есть вопросы, свяжитесь с нами.`,
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

/**
 * Обработка команды подтверждения бронирования
 */
async function handleConfirmCommand(
    fromPhone: string,
    bookingId: string | null,
    clientId: string | null,
    _bizId: string | null
) {
    if (!bookingId) {
        await sendWhatsApp({
            to: fromPhone,
            text: 'У вас нет активных бронирований для подтверждения.',
        });
        return;
    }

    try {
        const admin = getServiceClient();
        
        // Проверяем статус бронирования и владельца (client_id или client_phone)
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
                text: 'Это бронирование не связано с вашим номером. Используйте номер телефона, указанный при записи.',
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
                text: 'Это бронирование было отменено и не может быть подтверждено.',
            });
            return;
        }

        // Подтверждаем бронирование через RPC
        const { error: confirmError } = await admin.rpc('confirm_booking', {
            p_booking_id: bookingId,
        });

        if (confirmError) {
            logError('WhatsAppWebhook', 'Failed to confirm booking', { error: confirmError, bookingId });
            await sendWhatsApp({
                to: fromPhone,
                text: 'Не удалось подтвердить бронирование. Пожалуйста, попробуйте позже или свяжитесь с нами.',
            });
            return;
        }

        // Формируем сообщение о подтверждении
        const servicesForConfirm = booking.services as
            | { name_ru?: string }[]
            | { name_ru?: string }
            | null
            | undefined;
        const staffForConfirm = booking.staff as
            | { full_name?: string }[]
            | { full_name?: string }
            | null
            | undefined;

        const serviceName =
            Array.isArray(servicesForConfirm)
                ? servicesForConfirm[0]?.name_ru || 'услуга'
                : servicesForConfirm?.name_ru || 'услуга';

        const staffName =
            Array.isArray(staffForConfirm)
                ? staffForConfirm[0]?.full_name || 'мастер'
                : staffForConfirm?.full_name || 'мастер';
        const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');

        await sendWhatsApp({
            to: fromPhone,
            text: `✅ Бронирование подтверждено!\n\nУслуга: ${serviceName}\nМастер: ${staffName}\nДата и время: ${startTime}\n\nЖдем вас! Если возникнут вопросы, напишите нам.`,
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

/**
 * Команда «напомни» — список предстоящих бронирований
 */
async function handleRemindCommand(fromPhone: string, activeBookings: ActiveBookingRow[]) {
    try {
        if (activeBookings.length === 0) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'У вас нет предстоящих бронирований. Для записи посетите наш сайт или напишите нам.',
            });
            return;
        }
        const lines = activeBookings.map((b, i) => formatBookingListLine(b, i + 1)).join('\n');
        const header = activeBookings.length === 1
            ? '📅 Ваше ближайшее бронирование:\n\n'
            : `📅 У вас ${activeBookings.length} предстоящих бронирований:\n\n`;
        await sendWhatsApp({
            to: fromPhone,
            text: header + lines + '\n\nКоманды: «отмена 1», «подтвердить 1», «помощь».',
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Failed to send remind message', { error, fromPhone });
    }
}

/**
 * Обработка команды помощи
 */
async function handleHelpCommand(fromPhone: string, activeBookingsCount: number) {
    let helpText = '📋 Доступные команды:\n\n';
    helpText += '• "отмена" — отменить бронирование';
    if (activeBookingsCount > 1) helpText += ' (или "отмена 1", "отмена 2" при нескольких)';
    helpText += '\n';
    helpText += '• "подтвердить" — подтвердить бронирование';
    if (activeBookingsCount > 1) helpText += ' (или "подтвердить 1", "подтвердить 2")';
    helpText += '\n';
    helpText += '• "напомни" — показать предстоящие записи\n';
    helpText += '• "помощь" — это сообщение\n\n';

    if (activeBookingsCount > 0) {
        helpText += 'У вас есть активное бронирование. Используйте команды выше для управления им.';
    } else {
        helpText += 'Для создания нового бронирования посетите наш сайт или свяжитесь с нами.';
    }

    try {
        await sendWhatsApp({
            to: fromPhone,
            text: helpText,
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Failed to send help message', { error, fromPhone });
    }
}

/**
 * Отправка информации о бронировании
 */
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

        const servicesForInfo = booking.services as
            | { name_ru?: string }[]
            | { name_ru?: string }
            | null
            | undefined;
        const staffForInfo = booking.staff as
            | { full_name?: string }[]
            | { full_name?: string }
            | null
            | undefined;
        const branchesForInfo = booking.branches as
            | { name?: string; address?: string | null }[]
            | { name?: string; address?: string | null }
            | null
            | undefined;
        const businessesForInfo = booking.businesses as
            | { name?: string }[]
            | { name?: string }
            | null
            | undefined;

        const serviceName =
            Array.isArray(servicesForInfo)
                ? servicesForInfo[0]?.name_ru || 'услуга'
                : servicesForInfo?.name_ru || 'услуга';

        const staffName =
            Array.isArray(staffForInfo)
                ? staffForInfo[0]?.full_name || 'мастер'
                : staffForInfo?.full_name || 'мастер';

        const branchName =
            Array.isArray(branchesForInfo)
                ? branchesForInfo[0]?.name || 'филиал'
                : branchesForInfo?.name || 'филиал';

        const branchAddress =
            Array.isArray(branchesForInfo)
                ? branchesForInfo[0]?.address || ''
                : branchesForInfo?.address || '';

        const businessName =
            Array.isArray(businessesForInfo)
                ? businessesForInfo[0]?.name || ''
                : businessesForInfo?.name || '';

        const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');
        const endTime = formatInTimeZone(new Date(booking.end_at), TZ, 'HH:mm');

        let statusText = '';
        switch (booking.status) {
            case 'hold':
                statusText = '⏳ Ожидает подтверждения';
                break;
            case 'confirmed':
                statusText = '✅ Подтверждено';
                break;
            case 'paid':
                statusText = '✅ Оплачено';
                break;
            case 'cancelled':
                statusText = '❌ Отменено';
                break;
            default:
                statusText = booking.status;
        }

        const infoText = `📅 Ваше бронирование:\n\n` +
            `${statusText}\n\n` +
            `Услуга: ${serviceName}\n` +
            `Мастер: ${staffName}\n` +
            `Дата и время: ${startTime} - ${endTime}\n` +
            `Филиал: ${branchName}${branchAddress ? `\nАдрес: ${branchAddress}` : ''}\n` +
            `${businessName ? `\n${businessName}` : ''}\n\n` +
            `Команды: "отмена", "подтвердить", "помощь"`;

        await sendWhatsApp({
            to: fromPhone,
            text: infoText,
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Failed to send booking info', { error, bookingId, fromPhone });
    }
}

/**
 * Обработка обновления статуса сообщения
 */
async function handleStatusUpdate(status: WhatsAppStatus) {
    try {
        const admin = getServiceClient();
        
        // Обновляем статус в базе данных, если сообщение найдено
        const { data: message } = await admin
            .from('whatsapp_messages')
            .select('id, whatsapp_message_id')
            .eq('whatsapp_message_id', status.id)
            .maybeSingle();

        if (message) {
            // Обновляем статус доставки (можно расширить таблицу для хранения статусов)
            logDebug('WhatsAppWebhook', 'Message status updated', {
                messageId: status.id,
                status: status.status,
                recipientId: status.recipient_id,
            });

            // Здесь можно добавить обновление статуса в таблице whatsapp_messages
            // Например, добавить колонку delivery_status и обновлять её
        }
    } catch (error) {
        logError('WhatsAppWebhook', 'Error handling status update', { error, statusId: status.id });
    }
}

