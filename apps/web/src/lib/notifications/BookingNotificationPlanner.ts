import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ParticipantDataService } from './ParticipantDataService';
import { buildBookingEmailPayload } from './emailPayload';
import { buildEmailRecipients } from './emailRecipients';
import { listManagerPushRecipients } from './managerPushRecipients';
import { buildPushMessage, buildTelegramText } from './messageBuilders';
import { notificationLocale } from './notificationText';
import type { PreparedDelivery } from './outboxTypes';
import { uniqueTelegramRecipients } from './telegramRecipients';
import { isReminderType, type BookingDetails, type BookingEventType, type BookingRow, type ParticipantData } from './types';
import { first } from './utils';
import { whatsappRecipientPhone } from './whatsappRecipients';
import { bookingWhatsAppTemplateName, buildBookingWhatsAppTemplatePayload } from './whatsappTemplates';

import { getEmailFrom, getSiteOrigin, getTimezone } from '@/lib/env';
import { listPushTokens } from '@/lib/pushTokens';

const keyFor = (channel: string, recipient: string) => `${channel}:${createHash('sha256').update(recipient).digest('hex')}`;

/** A participant who receives nothing: staff and owner of a client-only message are not looked up. */
const NO_RECIPIENT: ParticipantData = {
    email: null, notificationEmails: [], name: null, phone: null, whatsappPhone: null, telegramId: null,
    notifyEmail: false, notifyWhatsApp: false, notifyTelegram: false, whatsappVerified: false, telegramVerified: false,
};

/**
 * Selection and rendering only. No provider calls, credentials or swallowed DB failures.
 * Each recipient's message is rendered in that recipient's preferred_locale (FE-10): client, staff
 * and owner may each get another language; a shared address/chat/number gets the first one's.
 * audience 'client' (reminders) loads and addresses the client only.
 */
export async function prepareBookingNotificationContext(participants: ParticipantDataService, booking: BookingRow, audience: 'all' | 'client' = 'all') {
    const biz = first(booking.biz);
    const staff = first(booking.staff);
    const [clientData, staffData, ownerData] = await Promise.all([
        participants.getClientData(booking),
        audience === 'all' ? participants.getStaffData(staff) : NO_RECIPIENT,
        audience === 'all' ? participants.getOwnerData(biz) : NO_RECIPIENT,
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

/**
 * The deliveries of one outbox event. Confirmations, cancellations and holds go to client, staff,
 * owner and the business addresses; reminders (24 h / 2 h before the visit) to the client only,
 * on the same channels and with the same opt-outs. Each channel is one block over the same
 * participants plus its transport branch; push goes to the client and, for confirm/cancel, the master, the owner and the business managers.
 */
export async function planBookingNotifications(admin: SupabaseClient, booking: BookingRow, type: BookingEventType): Promise<PreparedDelivery[]> {
    const reminder = isReminderType(type);
    const { details, clientData, staffData, ownerData } = await prepareBookingNotificationContext(
        new ParticipantDataService(admin, admin, true), booking, reminder ? 'client' : 'all');
    const biz = details.biz;
    // An empty EMAIL_FROM means e-mail notifications are off (env.ts): plan no e-mail deliveries
    // rather than ones with from: '' that fail at the provider on every event (R25-13).
    const from = getEmailFrom().trim();
    // A reminder needs no calendar file (the confirmation carried it) and no business addresses.
    const emailRecipients = buildEmailRecipients(clientData, staffData, ownerData, reminder ? null : biz)
        .map(recipient => reminder ? { ...recipient, withIcs: false } : recipient);
    const deliveries: PreparedDelivery[] = !from ? [] : emailRecipients.map(recipient => ({
        key: keyFor('email', recipient.email), channel: 'email',
        payload: buildBookingEmailPayload(recipient, details, type, { from, replyTo: ownerData.email ?? undefined }),
    }));
    for (const { data } of uniqueTelegramRecipients(clientData, staffData, ownerData)) {
        deliveries.push({ key: keyFor('telegram', String(data.telegramId)), channel: 'telegram', payload: {
            chat_id: data.telegramId, text: buildTelegramText(details, type, notificationLocale(data.locale)), parse_mode: 'HTML', disable_web_page_preview: true,
        } });
    }
    // WhatsApp only as an approved template (R25-07); without one for this type, no WhatsApp delivery.
    const templateName = bookingWhatsAppTemplateName(type);
    const phones = new Set<string>();
    for (const [role, data] of [['client', clientData], ['staff', staffData], ['owner', ownerData]] as const) {
        if (!templateName) break;
        const phone = whatsappRecipientPhone(role, data)?.replace(/\D/g, '');
        if (!phone || phones.has(phone)) continue;
        phones.add(phone);
        deliveries.push({ key: keyFor('whatsapp', phone), channel: 'whatsapp',
            payload: buildBookingWhatsAppTemplatePayload(phone, details, type, templateName, notificationLocale(data.locale)) });
    }
    // Push to the app (owner decision 2026-11-25): the client for confirm, cancel and both reminders,
    // the master's linked account for confirm and cancel; a hold is not pushed. For confirm and cancel
    // also the owner and the owner/admin/manager accounts of the business (O2, 2026-11-26), so a new or
    // cancelled booking reaches whoever manages it from the app. No profile flag exists for push; a
    // registered token is the opt-in, and the app's Profile switch removes it. One delivery per install;
    // a shared install gets one message in the language of the first recipient, like a shared Telegram chat.
    const staffEvent = type === 'confirm' || type === 'cancel';
    const managers = staffEvent ? await listManagerPushRecipients(admin, biz?.id, biz?.owner_id) : [];
    const pushRecipients = type === 'hold' ? [] : [
        { userId: booking.client_id, locale: clientData.locale },
        ...(staffEvent ? [{ userId: details.staff?.user_id ?? null, locale: staffData.locale }] : []),
        ...managers.map(manager => ({ userId: manager.userId, locale: manager.locale })),
    ].filter((recipient): recipient is { userId: string; locale: ParticipantData['locale'] } => Boolean(recipient.userId));
    if (pushRecipients.length > 0) {
        const tokens = await listPushTokens(admin, pushRecipients.map(recipient => recipient.userId));
        const pushed = new Set<string>();
        for (const { userId, locale } of pushRecipients) {
            for (const { token } of tokens.filter(row => row.user_id === userId)) {
                if (pushed.has(token)) continue;
                pushed.add(token);
                const { title, body } = buildPushMessage(details, type, notificationLocale(locale));
                deliveries.push({ key: keyFor('push', token), channel: 'push', payload: {
                    to: token, title, body, data: { bookingId: booking.id, type },
                    sound: 'default', priority: 'high', channelId: 'default',
                } });
            }
        }
    }
    if (deliveries.length > 200) throw new Error('NOTIFICATION_RECIPIENT_LIMIT');
    return deliveries;
}
