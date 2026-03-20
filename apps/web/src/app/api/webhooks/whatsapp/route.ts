// apps/web/src/app/api/webhooks/whatsapp/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { formatInTimeZone } from 'date-fns-tz';
import { NextRequest } from 'next/server';

import { withErrorHandler, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug, logError, logWarn } from '@/lib/log';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';
import {
    handleWhatsAppCancelCommand,
    handleWhatsAppConfirmCommand,
} from './whatsappWebhookBookingActions';
import {
    handleWhatsAppHelpCommand,
    handleWhatsAppRemindCommand,
    sendWhatsAppBookingInfo,
} from './whatsappWebhookBookingInfo';
import { handleWhatsAppTextCommand } from './whatsappWebhookCommands';
import { handleWhatsAppMediaMessage } from './whatsappWebhookMedia';
import { processWhatsAppWebhookBody } from './whatsappWebhookPayload';
import { handleWhatsAppStatusUpdate } from './whatsappWebhookStatus';
import type {
    ActiveBookingRow,
    WhatsAppMessage,
    WhatsAppStatus,
    WhatsAppWebhookBody,
} from './whatsappWebhookTypes';
import { verifyWhatsAppWebhookRequest } from './whatsappWebhookVerification';

export async function GET(req: NextRequest) {
    return withErrorHandler('WhatsAppWebhook', async () => {
        return verifyWhatsAppWebhookRequest(req);
    });
}

export async function POST(req: NextRequest) {
    return withErrorHandler('WhatsAppWebhook', async () => {
        const body = (await req.json()) as WhatsAppWebhookBody;
        await processWhatsAppWebhookBody(body, {
            onMessage: handleIncomingMessage,
            onStatus: handleStatusUpdate,
        });

        return createSuccessResponse({ success: true });
    });
}

function formatBookingListLine(booking: ActiveBookingRow, index: number): string {
    const services = booking.services;
    const staff = booking.staff;
    const serviceName = Array.isArray(services) ? services[0]?.name_ru || 'услуга' : (services as { name_ru?: string })?.name_ru || 'услуга';
    const staffName = Array.isArray(staff) ? staff[0]?.full_name || 'мастер' : (staff as { full_name?: string })?.full_name || 'мастер';
    const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');
    return `${index}. ${startTime} — ${serviceName}, ${staffName}`;
}

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

        const { data: existing } = await admin
            .from('whatsapp_messages')
            .select('id')
            .eq('whatsapp_message_id', messageId)
            .maybeSingle();

        if (existing) {
            logWarn('WhatsAppWebhook', 'Message already processed', { messageId });
            return;
        }
        // РС‰РµРј РєР»РёРµРЅС‚Р° РїРѕ РЅРѕРјРµСЂСѓ С‚РµР»РµС„РѕРЅР°
        // РќРѕРјРµСЂ РѕС‚ Meta РїСЂРёС…РѕРґРёС‚ РІ С„РѕСЂРјР°С‚Рµ Р±РµР· +, РЅСѓР¶РЅРѕ РЅРѕСЂРјР°Р»РёР·РѕРІР°С‚СЊ
        const normalizedPhone = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;
        
        let clientId: string | null = null;
        let activeBookings: ActiveBookingRow[] = [];
        let bizId: string | null = null;

        // РС‰РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РїРѕ РЅРѕРјРµСЂСѓ С‚РµР»РµС„РѕРЅР° РІ profiles
        const { data: profile } = await admin
            .from('profiles')
            .select('id, phone')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        if (profile) {
            clientId = profile.id;
            logDebug('WhatsAppWebhook', 'Found client by phone', { clientId, phone: normalizedPhone });
        }

        // РЎРѕР±РёСЂР°РµРј РґРѕ 10 Р°РєС‚РёРІРЅС‹С… Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№ РґР»СЏ РІС‹Р±РѕСЂР° (РѕС‚РјРµРЅР°/РїРѕРґС‚РІРµСЂРґРёС‚СЊ/РЅР°РїРѕРјРЅРё)
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

        // РЎРѕС…СЂР°РЅСЏРµРј СЃРѕРѕР±С‰РµРЅРёРµ РІ Р‘Р”
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

        // РћР±СЂР°Р±РѕС‚РєР° РјРµРґРёР°-С„Р°Р№Р»РѕРІ
        if (messageType !== 'text') {
            await handleMediaMessage(message, normalizedPhone, bookingId, bizId);
        }

        // РћР±СЂР°Р±РѕС‚РєР° С‚РµРєСЃС‚РѕРІС‹С… РєРѕРјР°РЅРґ (РїРµСЂРµРґР°С‘Рј СЃРїРёСЃРѕРє Р°РєС‚РёРІРЅС‹С… Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№ РґР»СЏ РІС‹Р±РѕСЂР° РёР· РЅРµСЃРєРѕР»СЊРєРёС…)
        if (messageType === 'text' && messageText) {
            await handleTextCommand(messageText, normalizedPhone, activeBookings, clientId, bizId);
            await admin
                .from('whatsapp_messages')
                .update({ processed: true })
                .eq('whatsapp_message_id', messageId);
        }
    } catch (error) {
        // Р›РѕРіРёСЂСѓРµРј РѕС€РёР±РєСѓ, РЅРѕ РЅРµ РїСЂРµСЂС‹РІР°РµРј РѕР±СЂР°Р±РѕС‚РєСѓ РґСЂСѓРіРёС… СЃРѕРѕР±С‰РµРЅРёР№
        logError('WhatsAppWebhook', 'Error handling incoming message', {
            error,
            message: message.id,
        });
    }
}

/**
 * РћР±СЂР°Р±РѕС‚РєР° РјРµРґРёР°-С„Р°Р№Р»РѕРІ (РёР·РѕР±СЂР°Р¶РµРЅРёСЏ, Р°СѓРґРёРѕ, РІРёРґРµРѕ, РґРѕРєСѓРјРµРЅС‚С‹)
 */
async function handleMediaMessage(
    message: WhatsAppMessage,
    fromPhone: string,
    bookingId: string | null,
    _bizId: string | null
) {
    return handleWhatsAppMediaMessage(message, fromPhone, bookingId, _bizId);
}

/**
 * РћР±СЂР°Р±РѕС‚РєР° С‚РµРєСЃС‚РѕРІС‹С… РєРѕРјР°РЅРґ (РїРѕРґРґРµСЂР¶РєР° РѕРґРЅРѕРіРѕ РёР»Рё РЅРµСЃРєРѕР»СЊРєРёС… Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№)
 */
async function handleTextCommand(
    messageText: string,
    fromPhone: string,
    activeBookings: ActiveBookingRow[],
    clientId: string | null,
    bizId: string | null
) {
    return handleWhatsAppTextCommand(messageText, fromPhone, activeBookings, {
        onRemind: () => handleRemindCommand(fromPhone, activeBookings),
        onCancel: (bookingId) => handleCancelCommand(fromPhone, bookingId, clientId, bizId),
        onConfirm: (bookingId) => handleConfirmCommand(fromPhone, bookingId, clientId, bizId),
        onHelp: () => handleHelpCommand(fromPhone, activeBookings.length),
        onInfo: (bookingId) => sendBookingInfo(fromPhone, bookingId),
        formatBookingLine: formatBookingListLine,
    });
}

/**
 * РћР±СЂР°Р±РѕС‚РєР° РєРѕРјР°РЅРґС‹ РѕС‚РјРµРЅС‹ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ
 */
async function handleCancelCommand(
    fromPhone: string,
    bookingId: string | null,
    clientId: string | null,
    _bizId: string | null
) {
    return handleWhatsAppCancelCommand({ fromPhone, bookingId, clientId });
}

/**
 * РћР±СЂР°Р±РѕС‚РєР° РєРѕРјР°РЅРґС‹ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ
 */
async function handleConfirmCommand(
    fromPhone: string,
    bookingId: string | null,
    clientId: string | null,
    _bizId: string | null
) {
    return handleWhatsAppConfirmCommand({ fromPhone, bookingId, clientId });
}

/**
 * РљРѕРјР°РЅРґР° В«РЅР°РїРѕРјРЅРёВ» вЂ” СЃРїРёСЃРѕРє РїСЂРµРґСЃС‚РѕСЏС‰РёС… Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№
 */
async function handleRemindCommand(fromPhone: string, activeBookings: ActiveBookingRow[]) {
    return handleWhatsAppRemindCommand(fromPhone, activeBookings, formatBookingListLine);
}

/**
 * РћР±СЂР°Р±РѕС‚РєР° РєРѕРјР°РЅРґС‹ РїРѕРјРѕС‰Рё
 */
async function handleHelpCommand(fromPhone: string, activeBookingsCount: number) {
    return handleWhatsAppHelpCommand(fromPhone, activeBookingsCount);
}

/**
 * РћС‚РїСЂР°РІРєР° РёРЅС„РѕСЂРјР°С†РёРё Рѕ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёРё
 */
async function sendBookingInfo(fromPhone: string, bookingId: string) {
    return sendWhatsAppBookingInfo(fromPhone, bookingId);
}

/**
 * РћР±СЂР°Р±РѕС‚РєР° РѕР±РЅРѕРІР»РµРЅРёСЏ СЃС‚Р°С‚СѓСЃР° СЃРѕРѕР±С‰РµРЅРёСЏ
 */
async function handleStatusUpdate(status: WhatsAppStatus) {
    return handleWhatsAppStatusUpdate(status);
}

