// apps/web/src/lib/notifications/messageBuilders.ts

import {
    formatNotificationDateTime,
    formatNotificationTime,
    notificationServiceName,
    notificationStatus,
    notificationText,
    notificationTitle,
    type NotificationLocale,
} from './notificationText';
import type { BookingRow, ServiceRow, StaffRow, BizRow, BranchRow, NotifyType } from './types';

import { escapeHtml } from '@/lib/htmlEscape';

export interface BookingDetails {
    booking: BookingRow;
    service: ServiceRow | null;
    staff: StaffRow | null;
    biz: BizRow | null;
    branch: BranchRow | null;
    clientName: string | null;
    clientPhone: string | null;
    clientEmail: string | null;
    origin: string;
    timezone: string;
}

/** The values every message shows, in the recipient's language (FE-10). */
function commonParts(details: BookingDetails, notifyType: NotifyType, locale: NotificationLocale) {
    const { booking, service, staff, biz, origin, timezone } = details;
    return {
        title: notificationTitle(notifyType, locale),
        when: formatNotificationDateTime(booking.start_at, timezone, locale),
        svcName: notificationServiceName(service, locale),
        master: staff?.full_name ?? notificationText(locale, 'server.notifications.master'),
        bizName: biz?.name ?? notificationText(locale, 'server.notifications.business'),
        link: `${origin}/booking/${booking.id}`,
        statusText: notificationStatus(booking.status, locale),
        label: (key: Parameters<typeof notificationText>[1]) => notificationText(locale, key),
    };
}

/** The values of the e-mail versions. */
function emailParts(details: BookingDetails, notifyType: NotifyType, locale: NotificationLocale) {
    const { booking, service, staff, biz, branch, clientName, clientPhone, clientEmail, timezone } = details;
    const svcDuration = service?.duration_min ?? 0;
    const svcPriceFrom = service?.price_from;
    const svcPriceTo = service?.price_to;
    const priceText = svcPriceFrom && svcPriceTo
        ? (svcPriceFrom === svcPriceTo
            ? notificationText(locale, 'server.notifications.price', { amount: svcPriceFrom })
            : notificationText(locale, 'server.notifications.priceRange', { from: svcPriceFrom, to: svcPriceTo }))
        : svcPriceFrom ? notificationText(locale, 'server.notifications.price', { amount: svcPriceFrom }) : null;

    // Информация о клиенте
    const label = (key: Parameters<typeof notificationText>[1]) => notificationText(locale, key);
    const clientInfo = [];
    if (clientName) clientInfo.push(`${label('server.notifications.clientName')}: ${clientName}`);
    if (clientPhone) clientInfo.push(`${label('server.notifications.clientPhone')}: ${clientPhone}`);
    if (clientEmail && !booking.client_id) clientInfo.push(`Email: ${clientEmail}`); // Только для гостевых броней

    return {
        ...commonParts(details, notifyType, locale),
        whenEnd: formatNotificationTime(booking.end_at, timezone),
        created: formatNotificationDateTime(booking.created_at, timezone, locale),
        svcDuration,
        durationText: notificationText(locale, 'server.notifications.durationMinutes', { minutes: svcDuration }),
        priceText,
        masterPhone: staff?.phone,
        bizAddress: biz?.address,
        bizPhones: biz?.phones ?? [],
        branchName: branch?.name,
        branchAddress: branch?.address,
        clientInfoText: clientInfo.length > 0 ? clientInfo.join(', ') : label('server.notifications.clientUnknown'),
    };
}

/**
 * Строит HTML версию письма
 */
export function buildEmailHtml(details: BookingDetails, notifyType: NotifyType, locale: NotificationLocale = 'ru'): string {
    const { booking, timezone } = details;
    // Names, contacts, addresses and titles come from clients, guests and businesses: every value
    // is escaped, or a guest name could put links or images into the e-mail (API-07).
    const e = escapeHtml;
    const {
        title, when, whenEnd, created, svcName, svcDuration, durationText, priceText, master, masterPhone,
        bizName, bizAddress, bizPhones, branchName, branchAddress, link, statusText, clientInfoText, label,
    } = emailParts(details, notifyType, locale);
    const statusColor = booking.status === 'confirmed' || booking.status === 'paid' ? '#059669' : booking.status === 'cancelled' ? '#dc2626' : '#f59e0b';

    return `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#1f2937;">
        <h2 style="margin:0 0 16px 0;color:#111827;font-size:20px;">${e(title)}: ${e(bizName)}</h2>

        <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#111827;">${e(label('server.notifications.detailsHeading'))}</h3>
          <p style="margin:0 0 8px 0;"><b>${e(label('server.notifications.bookingNumber'))}:</b> <code style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-size:12px;">${e(booking.id.slice(0, 8))}</code></p>
          <p style="margin:0 0 8px 0;"><b>${e(label('server.notifications.service'))}:</b> ${e(svcName)}${svcDuration ? ` (${e(durationText)})` : ''}${priceText ? ` — ${e(priceText)}` : ''}</p>
          <p style="margin:0 0 8px 0;"><b>${e(label('server.notifications.master'))}:</b> ${e(master)}${masterPhone ? ` (${e(masterPhone)})` : ''}</p>
          <p style="margin:0 0 8px 0;"><b>${e(label('server.notifications.time'))}:</b> ${e(when)} - ${e(whenEnd)} (${e(timezone)})</p>
          <p style="margin:0 0 8px 0;"><b>${e(label('server.notifications.status'))}:</b> <span style="color:${statusColor};font-weight:600;">${e(statusText)}</span></p>
          ${branchName ? `<p style="margin:0 0 8px 0;"><b>${e(label('server.notifications.branch'))}:</b> ${e(branchName)}${branchAddress ? ` — ${e(branchAddress)}` : ''}</p>` : ''}
          ${!branchName && bizAddress ? `<p style="margin:0 0 8px 0;"><b>${e(label('server.notifications.address'))}:</b> ${e(bizAddress)}</p>` : ''}
          <p style="margin:0 0 0 0;"><b>${e(label('server.notifications.created'))}:</b> ${e(created)}</p>
        </div>

        <div style="background:#eff6ff;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#111827;">${e(label('server.notifications.clientHeading'))}</h3>
          <p style="margin:0 0 0 0;">${e(clientInfoText)}</p>
        </div>

        ${bizPhones.length > 0 ? `
        <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#111827;">${e(label('server.notifications.contacts'))}</h3>
          <p style="margin:0 0 0 0;"><b>${e(label('server.notifications.phones'))}:</b> ${bizPhones.map(p => `<a href="tel:${e(String(p).replace(/[^\d+]/g, ''))}" style="color:#2563eb;text-decoration:none;">${e(p)}</a>`).join(', ')}</p>
        </div>
        ` : ''}

        <div style="margin:16px 0;text-align:center;">
          <a href="${e(link)}" target="_blank" rel="noopener" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">${e(label('server.notifications.openBookingInSystem'))}</a>
        </div>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <small style="color:#6b7280;font-size:12px;">${e(label('server.notifications.emailFooter'))}</small>
      </div>
    `.trim();
}

/**
 * Строит текстовую версию письма
 */
export function buildEmailText(details: BookingDetails, notifyType: NotifyType, locale: NotificationLocale = 'ru'): string {
    const { booking, timezone } = details;
    const {
        title, when, whenEnd, created, svcName, svcDuration, durationText, priceText, master, masterPhone,
        bizName, bizAddress, bizPhones, branchName, branchAddress, link, statusText, clientInfoText, label,
    } = emailParts(details, notifyType, locale);

    return `${title}: ${bizName}\n\n` +
        `${label('server.notifications.detailsHeading')}:\n` +
        `${label('server.notifications.bookingNumber')}: ${booking.id.slice(0, 8)}\n` +
        `${label('server.notifications.service')}: ${svcName}${svcDuration ? ` (${durationText})` : ''}${priceText ? ` — ${priceText}` : ''}\n` +
        `${label('server.notifications.master')}: ${master}${masterPhone ? ` (${masterPhone})` : ''}\n` +
        `${label('server.notifications.time')}: ${when} - ${whenEnd} (${timezone})\n` +
        `${label('server.notifications.status')}: ${statusText}\n` +
        `${branchName ? `${label('server.notifications.branch')}: ${branchName}${branchAddress ? ` — ${branchAddress}` : ''}\n` : ''}` +
        `${!branchName && bizAddress ? `${label('server.notifications.address')}: ${bizAddress}\n` : ''}` +
        `${label('server.notifications.created')}: ${created}\n\n` +
        `${label('server.notifications.clientHeading')}:\n` +
        `${clientInfoText}\n\n` +
        `${bizPhones.length > 0 ? `${label('server.notifications.contacts')}: ${bizPhones.join(', ')}\n\n` : ''}` +
        `${label('server.notifications.link')}: ${link}`;
}

/**
 * Строит текст для WhatsApp
 */
export function buildWhatsAppText(details: BookingDetails, notifyType: NotifyType, locale: NotificationLocale = 'ru'): string {
    const { title, when, svcName, master, bizName, link, statusText, label } = commonParts(details, notifyType, locale);

    return `${title}: ${bizName}\n\n` +
        `${label('server.notifications.service')}: ${svcName}\n` +
        `${label('server.notifications.master')}: ${master}\n` +
        `${label('server.notifications.time')}: ${when}\n` +
        `${label('server.notifications.status')}: ${statusText}\n\n${link}`;
}

/**
 * Строит текст для Telegram
 */
export function buildTelegramText(details: BookingDetails, notifyType: NotifyType, locale: NotificationLocale = 'ru'): string {
    const { timezone } = details;
    // Sent with parse_mode HTML: unescaped <, > or & in a business or service name would make
    // Telegram reject the message, and tags would format or link it (API-07).
    const e = escapeHtml;
    const { title, when, svcName, master, bizName, link, statusText, label } = commonParts(details, notifyType, locale);

    return `${e(title)}: <b>${e(bizName)}</b>\n\n` +
        `<b>${e(label('server.notifications.service'))}:</b> ${e(svcName)}\n` +
        `<b>${e(label('server.notifications.master'))}:</b> ${e(master)}\n` +
        `<b>${e(label('server.notifications.time'))}:</b> ${e(when)} (${e(timezone)})\n` +
        `<b>${e(label('server.notifications.status'))}:</b> ${e(statusText)}\n\n` +
        `<a href="${e(link)}">${e(label('server.notifications.openBooking'))}</a>`;
}
