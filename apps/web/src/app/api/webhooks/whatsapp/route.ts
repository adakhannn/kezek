// apps/web/src/app/api/webhooks/whatsapp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError, logWarn } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'kezek_whatsapp_verify';

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
        let bookingId: string | null = null;
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

        // Если нашли клиента, ищем активное бронирование
        if (clientId) {
            // Ищем ближайшее активное бронирование (hold, confirmed, paid)
            const { data: activeBooking } = await admin
                .from('bookings')
                .select('id, biz_id, status, start_at')
                .eq('client_id', clientId)
                .in('status', ['hold', 'confirmed', 'paid'])
                .gte('start_at', new Date().toISOString()) // Только будущие
                .order('start_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (activeBooking) {
                bookingId = activeBooking.id;
                bizId = activeBooking.biz_id;
                logDebug('WhatsAppWebhook', 'Found active booking', { bookingId, bizId });
            } else {
                // Если нет активного бронирования, ищем последнее для определения бизнеса
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
        } else {
            // Если клиент не найден, пытаемся найти по номеру в bookings (для гостевых бронирований)
            const { data: guestBooking } = await admin
                .from('bookings')
                .select('id, biz_id, client_phone')
                .eq('client_phone', normalizedPhone)
                .in('status', ['hold', 'confirmed', 'paid'])
                .gte('start_at', new Date().toISOString())
                .order('start_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (guestBooking) {
                bookingId = guestBooking.id;
                bizId = guestBooking.biz_id;
                logDebug('WhatsAppWebhook', 'Found guest booking by phone', { bookingId, bizId });
            }
        }

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

        // TODO: Здесь можно добавить логику автоматических ответов
        // Например, если сообщение содержит "отмена" или "подтвердить"
        if (messageType === 'text' && messageText) {
            const lowerText = messageText.toLowerCase().trim();
            
            // Простая обработка команд (можно расширить)
            if (lowerText === 'отмена' || lowerText === 'cancel' || lowerText === 'отменить') {
                // TODO: Обработка отмены бронирования
                logDebug('WhatsAppWebhook', 'Cancel command detected', { bookingId });
            } else if (lowerText === 'подтвердить' || lowerText === 'confirm' || lowerText === 'да') {
                // TODO: Обработка подтверждения бронирования
                logDebug('WhatsAppWebhook', 'Confirm command detected', { bookingId });
            }
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
 * Обработка обновления статуса сообщения
 */
async function handleStatusUpdate(status: WhatsAppStatus) {
    // Здесь можно добавить логику обновления статусов в базе данных
    // Например, отмечать, что уведомление было доставлено/прочитано
    void status; // временно, чтобы избежать unused variable
}

