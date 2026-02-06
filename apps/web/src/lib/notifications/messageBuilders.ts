// apps/web/src/lib/notifications/messageBuilders.ts

import { formatInTimeZone } from 'date-fns-tz';

import type { BookingRow, ServiceRow, StaffRow, BizRow, BranchRow, NotifyType } from './types';
import { statusRu } from './utils';

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

/**
 * Строит HTML версию письма
 */
export function buildEmailHtml(details: BookingDetails, notifyType: NotifyType): string {
    const { booking, service, staff, biz, branch, clientName, clientPhone, clientEmail, origin, timezone } = details;
    
    const title =
        notifyType === 'hold'    ? 'Удержание слота' :
        notifyType === 'confirm' ? 'Бронь подтверждена' :
        'Бронь отменена';

    const when = formatInTimeZone(new Date(booking.start_at), timezone, 'dd.MM.yyyy HH:mm');
    const whenEnd = formatInTimeZone(new Date(booking.end_at), timezone, 'HH:mm');
    const created = formatInTimeZone(new Date(booking.created_at), timezone, 'dd.MM.yyyy HH:mm');
    const svcName = service?.name_ru ?? 'Услуга';
    const svcDuration = service?.duration_min ?? 0;
    const svcPriceFrom = service?.price_from;
    const svcPriceTo = service?.price_to;
    const priceText = svcPriceFrom && svcPriceTo 
        ? (svcPriceFrom === svcPriceTo ? `${svcPriceFrom} сом` : `${svcPriceFrom} - ${svcPriceTo} сом`)
        : svcPriceFrom ? `${svcPriceFrom} сом` : null;
    const master = staff?.full_name ?? 'Мастер';
    const masterPhone = staff?.phone;
    const bizName = biz?.name ?? 'Бизнес';
    const bizAddress = biz?.address;
    const bizPhones = biz?.phones ?? [];
    const branchName = branch?.name;
    const branchAddress = branch?.address;
    const link = `${origin}/booking/${booking.id}`;
    const statusRuText = statusRu(booking.status);
    
    // Информация о клиенте
    const clientInfo = [];
    if (clientName) clientInfo.push(`Имя: ${clientName}`);
    if (clientPhone) clientInfo.push(`Телефон: ${clientPhone}`);
    if (clientEmail && !booking.client_id) clientInfo.push(`Email: ${clientEmail}`); // Только для гостевых броней
    const clientInfoText = clientInfo.length > 0 ? clientInfo.join(', ') : 'Клиент не указан';

    return `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#1f2937;">
        <h2 style="margin:0 0 16px 0;color:#111827;font-size:20px;">${title}: ${bizName}</h2>
        
        <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#111827;">Детали бронирования</h3>
          <p style="margin:0 0 8px 0;"><b>Номер брони:</b> <code style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-size:12px;">${booking.id.slice(0, 8)}</code></p>
          <p style="margin:0 0 8px 0;"><b>Услуга:</b> ${svcName}${svcDuration ? ` (${svcDuration} мин)` : ''}${priceText ? ` — ${priceText}` : ''}</p>
          <p style="margin:0 0 8px 0;"><b>Мастер:</b> ${master}${masterPhone ? ` (${masterPhone})` : ''}</p>
          <p style="margin:0 0 8px 0;"><b>Время:</b> ${when} - ${whenEnd} (${timezone})</p>
          <p style="margin:0 0 8px 0;"><b>Статус:</b> <span style="color:${booking.status === 'confirmed' || booking.status === 'paid' ? '#059669' : booking.status === 'cancelled' ? '#dc2626' : '#f59e0b'};font-weight:600;">${statusRuText}</span></p>
          ${branchName ? `<p style="margin:0 0 8px 0;"><b>Филиал:</b> ${branchName}${branchAddress ? ` — ${branchAddress}` : ''}</p>` : ''}
          ${!branchName && bizAddress ? `<p style="margin:0 0 8px 0;"><b>Адрес:</b> ${bizAddress}</p>` : ''}
          <p style="margin:0 0 0 0;"><b>Создано:</b> ${created}</p>
        </div>
        
        <div style="background:#eff6ff;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#111827;">Информация о клиенте</h3>
          <p style="margin:0 0 0 0;">${clientInfoText}</p>
        </div>
        
        ${bizPhones.length > 0 ? `
        <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#111827;">Контакты</h3>
          <p style="margin:0 0 0 0;"><b>Телефоны:</b> ${bizPhones.map(p => `<a href="tel:${p}" style="color:#2563eb;text-decoration:none;">${p}</a>`).join(', ')}</p>
        </div>
        ` : ''}
        
        <div style="margin:16px 0;text-align:center;">
          <a href="${link}" target="_blank" rel="noopener" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Открыть бронь в системе</a>
        </div>
        
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <small style="color:#6b7280;font-size:12px;">Письмо отправлено автоматически системой Kezek</small>
      </div>
    `.trim();
}

/**
 * Строит текстовую версию письма
 */
export function buildEmailText(details: BookingDetails, notifyType: NotifyType): string {
    const { booking, service, staff, biz, branch, clientName, clientPhone, clientEmail, origin, timezone } = details;
    
    const title =
        notifyType === 'hold'    ? 'Удержание слота' :
        notifyType === 'confirm' ? 'Бронь подтверждена' :
        'Бронь отменена';

    const when = formatInTimeZone(new Date(booking.start_at), timezone, 'dd.MM.yyyy HH:mm');
    const whenEnd = formatInTimeZone(new Date(booking.end_at), timezone, 'HH:mm');
    const created = formatInTimeZone(new Date(booking.created_at), timezone, 'dd.MM.yyyy HH:mm');
    const svcName = service?.name_ru ?? 'Услуга';
    const svcDuration = service?.duration_min ?? 0;
    const svcPriceFrom = service?.price_from;
    const svcPriceTo = service?.price_to;
    const priceText = svcPriceFrom && svcPriceTo 
        ? (svcPriceFrom === svcPriceTo ? `${svcPriceFrom} сом` : `${svcPriceFrom} - ${svcPriceTo} сом`)
        : svcPriceFrom ? `${svcPriceFrom} сом` : null;
    const master = staff?.full_name ?? 'Мастер';
    const masterPhone = staff?.phone;
    const bizName = biz?.name ?? 'Бизнес';
    const bizAddress = biz?.address;
    const bizPhones = biz?.phones ?? [];
    const branchName = branch?.name;
    const branchAddress = branch?.address;
    const link = `${origin}/booking/${booking.id}`;
    const statusRuText = statusRu(booking.status);
    
    // Информация о клиенте
    const clientInfo = [];
    if (clientName) clientInfo.push(`Имя: ${clientName}`);
    if (clientPhone) clientInfo.push(`Телефон: ${clientPhone}`);
    if (clientEmail && !booking.client_id) clientInfo.push(`Email: ${clientEmail}`);
    const clientInfoText = clientInfo.length > 0 ? clientInfo.join(', ') : 'Клиент не указан';

    return `${title}: ${bizName}\n\n` +
        `Детали бронирования:\n` +
        `Номер брони: ${booking.id.slice(0, 8)}\n` +
        `Услуга: ${svcName}${svcDuration ? ` (${svcDuration} мин)` : ''}${priceText ? ` — ${priceText}` : ''}\n` +
        `Мастер: ${master}${masterPhone ? ` (${masterPhone})` : ''}\n` +
        `Время: ${when} - ${whenEnd} (${timezone})\n` +
        `Статус: ${statusRuText}\n` +
        `${branchName ? `Филиал: ${branchName}${branchAddress ? ` — ${branchAddress}` : ''}\n` : ''}` +
        `${!branchName && bizAddress ? `Адрес: ${bizAddress}\n` : ''}` +
        `Создано: ${created}\n\n` +
        `Информация о клиенте:\n` +
        `${clientInfoText}\n\n` +
        `${bizPhones.length > 0 ? `Контакты: ${bizPhones.join(', ')}\n\n` : ''}` +
        `Ссылка: ${link}`;
}

/**
 * Строит текст для WhatsApp
 */
export function buildWhatsAppText(details: BookingDetails, notifyType: NotifyType): string {
    const { booking, service, staff, biz, origin, timezone } = details;
    
    const title =
        notifyType === 'hold'    ? 'Удержание слота' :
        notifyType === 'confirm' ? 'Бронь подтверждена' :
        'Бронь отменена';

    const when = formatInTimeZone(new Date(booking.start_at), timezone, 'dd.MM.yyyy HH:mm');
    const svcName = service?.name_ru ?? 'Услуга';
    const master = staff?.full_name ?? 'Мастер';
    const bizName = biz?.name ?? 'Бизнес';
    const link = `${origin}/booking/${booking.id}`;
    const statusRuText = statusRu(booking.status);

    return `${title}: ${bizName}\n\nУслуга: ${svcName}\nМастер: ${master}\nВремя: ${when}\nСтатус: ${statusRuText}\n\n${link}`;
}

/**
 * Строит текст для Telegram
 */
export function buildTelegramText(details: BookingDetails, notifyType: NotifyType): string {
    const { booking, service, staff, biz, origin, timezone } = details;
    
    const title =
        notifyType === 'hold'    ? 'Удержание слота' :
        notifyType === 'confirm' ? 'Бронь подтверждена' :
        'Бронь отменена';

    const when = formatInTimeZone(new Date(booking.start_at), timezone, 'dd.MM.yyyy HH:mm');
    const svcName = service?.name_ru ?? 'Услуга';
    const master = staff?.full_name ?? 'Мастер';
    const bizName = biz?.name ?? 'Бизнес';
    const link = `${origin}/booking/${booking.id}`;
    const statusRuText = statusRu(booking.status);

    return `${title}: <b>${bizName}</b>\n\n` +
        `<b>Услуга:</b> ${svcName}\n` +
        `<b>Мастер:</b> ${master}\n` +
        `<b>Время:</b> ${when} (${timezone})\n` +
        `<b>Статус:</b> ${statusRuText}\n\n` +
        `<a href="${link}">Открыть бронь</a>`;
}

