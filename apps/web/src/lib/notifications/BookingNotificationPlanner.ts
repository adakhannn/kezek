import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ParticipantDataService } from './ParticipantDataService';
import { buildBookingEmailPayload } from './emailPayload';
import { buildEmailRecipients } from './emailRecipients';
import { buildTelegramText, buildWhatsAppText } from './messageBuilders';
import { notificationLocale } from './notificationText';
import type { PreparedDelivery } from './outboxTypes';
import { uniqueTelegramRecipients } from './telegramRecipients';
import type { BookingDetails, BookingRow, NotifyType } from './types';
import { first } from './utils';
import { whatsappRecipientPhone } from './whatsappRecipients';

import { getEmailFrom, getSiteOrigin, getTimezone } from '@/lib/env';

const keyFor = (channel: string, recipient: string) => `${channel}:${createHash('sha256').update(recipient).digest('hex')}`;

/**
 * Selection and rendering only. No provider calls, credentials or swallowed DB failures.
 * Each recipient's message is rendered in that recipient's preferred_locale (FE-10): client, staff
 * and owner may each get another language; a shared address/chat/number gets the first one's.
 */
export async function prepareBookingNotificationContext(participants: ParticipantDataService, booking: BookingRow) {
    const biz = first(booking.biz);
    const staff = first(booking.staff);
    const [clientData, staffData, ownerData] = await Promise.all([
        participants.getClientData(booking), participants.getStaffData(staff), participants.getOwnerData(biz),
    ]);
    const origin = getSiteOrigin();
    const timezone = biz?.tz === null ? getTimezone() : biz?.tz;
    if (typeof timezone !== 'string') throw new Error('NOTIFICATION_TIMEZONE_MISSING');
    try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(0); }
    catch { throw new Error('NOTIFICATION_TIMEZONE_INVALID'); }
    const details: BookingDetails = {
        booking, biz, staff, service: first(booking.services), branch: first(booking.branches),
        clientName: clientData.name, clientEmail: clientData.email, clientPhone: clientData.phone,
        timezone, origin,
    };
    return { details, clientData, staffData, ownerData };
}

export async function planBookingNotifications(admin: SupabaseClient, booking: BookingRow, type: NotifyType): Promise<PreparedDelivery[]> {
    const { details, clientData, staffData, ownerData } = await prepareBookingNotificationContext(new ParticipantDataService(admin, admin, true), booking);
    const biz = details.biz;
    // An empty EMAIL_FROM means e-mail notifications are off (env.ts): plan no e-mail deliveries
    // rather than ones with from: '' that fail at the provider on every event (R25-13).
    const from = getEmailFrom().trim();
    const deliveries: PreparedDelivery[] = !from ? [] : buildEmailRecipients(clientData, staffData, ownerData, biz).map(recipient => ({
        key: keyFor('email', recipient.email), channel: 'email',
        payload: buildBookingEmailPayload(recipient, details, type, { from, replyTo: ownerData.email ?? undefined }),
    }));
    for (const { data } of uniqueTelegramRecipients(clientData, staffData, ownerData)) {
        deliveries.push({ key: keyFor('telegram', String(data.telegramId)), channel: 'telegram', payload: {
            chat_id: data.telegramId, text: buildTelegramText(details, type, notificationLocale(data.locale)), parse_mode: 'HTML', disable_web_page_preview: true,
        } });
    }
    const phones = new Set<string>();
    for (const [role, data] of [['client', clientData], ['staff', staffData], ['owner', ownerData]] as const) {
        const phone = whatsappRecipientPhone(role, data)?.replace(/\D/g, '');
        if (!phone || phones.has(phone)) continue;
        phones.add(phone);
        deliveries.push({ key: keyFor('whatsapp', phone), channel: 'whatsapp', payload: {
            messaging_product: 'whatsapp', recipient_type: 'individual', to: phone, type: 'text',
            text: { preview_url: false, body: buildWhatsAppText(details, type, notificationLocale(data.locale)) },
        } });
    }
    if (deliveries.length > 200) throw new Error('NOTIFICATION_RECIPIENT_LIMIT');
    return deliveries;
}
