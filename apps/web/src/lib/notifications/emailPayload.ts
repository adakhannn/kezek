import { buildEmailHtml, buildEmailText } from './messageBuilders';
import { notificationServiceName, notificationText, notificationTitle } from './notificationText';
import type { BookingDetails, EmailRecipient, NotifyType } from './types';
import { buildHtmlPersonal } from './utils';

import { buildIcs, type IcsStatus } from '@/lib/ics';

const ICS_STATUS: Record<NotifyType, IcsStatus> = { hold: 'TENTATIVE', confirm: 'CONFIRMED', cancel: 'CANCELLED' };

/** The e-mail of one recipient, in that recipient's language (FE-10; Russian when unknown). */
export function buildBookingEmailPayload(
    recipient: EmailRecipient,
    details: BookingDetails,
    type: NotifyType,
    config: { from: string; replyTo?: string },
): Record<string, unknown> {
    const locale = recipient.locale ?? 'ru';
    const title = notificationTitle(type, locale);
    const payload: Record<string, unknown> = {
        from: config.from, to: [recipient.email],
        subject: `Kezek: ${title}`,
        html: buildHtmlPersonal(buildEmailHtml(details, type, locale), recipient.name, recipient.role, locale),
        text: buildEmailText(details, type, locale),
    };
    if (config.replyTo) payload.reply_to = config.replyTo;
    if (recipient.withIcs) {
        const master = notificationText(locale, 'server.notifications.master');
        const ics = buildIcs({
            id: details.booking.id,
            summary: `${notificationServiceName(details.service, locale)} — ${details.biz?.name ?? notificationText(locale, 'server.notifications.business')}`,
            description: `${title}. ${master}: ${details.staff?.full_name ?? master}`,
            location: details.biz?.address ?? '', startISO: details.booking.start_at, endISO: details.booking.end_at,
            url: `${details.origin}/booking/${details.booking.id}`,
            status: ICS_STATUS[type], sequence: details.booking.notification_revision,
        });
        payload.attachments = [{ filename: 'booking.ics', content: Buffer.from(ics, 'utf8').toString('base64') }];
    }
    return payload;
}
