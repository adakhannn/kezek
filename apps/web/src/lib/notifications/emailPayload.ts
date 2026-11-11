import { buildEmailHtml, buildEmailText } from './messageBuilders';
import type { BookingDetails, EmailRecipient, NotifyType } from './types';
import { buildHtmlPersonal } from './utils';

import { buildIcs } from '@/lib/ics';

export function buildBookingEmailPayload(
    recipient: EmailRecipient,
    details: BookingDetails,
    type: NotifyType,
    config: { from: string; replyTo?: string },
): Record<string, unknown> {
    const payload: Record<string, unknown> = {
        from: config.from, to: [recipient.email],
        subject: `Kezek: ${type === 'hold' ? 'Удержание слота' : type === 'confirm' ? 'Бронь подтверждена' : 'Бронь отменена'}`,
        html: buildHtmlPersonal(buildEmailHtml(details, type), recipient.name, recipient.role),
        text: buildEmailText(details, type),
    };
    if (config.replyTo) payload.reply_to = config.replyTo;
    if (recipient.withIcs) {
        const ics = buildIcs({
            id: details.booking.id,
            summary: `${details.service?.name_ru ?? 'Услуга'} — ${details.biz?.name ?? 'Бизнес'}`,
            description: `${type === 'hold' ? 'Удержание слота' : type === 'confirm' ? 'Бронь подтверждена' : 'Бронь отменена'}. Мастер: ${details.staff?.full_name ?? 'Мастер'}`,
            location: details.biz?.address ?? '', startISO: details.booking.start_at, endISO: details.booking.end_at,
            tz: details.timezone, url: `${details.origin}/booking/${details.booking.id}`,
        });
        payload.attachments = [{ filename: 'booking.ics', content: Buffer.from(ics, 'utf8').toString('base64') }];
    }
    return payload;
}
