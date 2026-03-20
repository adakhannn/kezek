import { formatInTimeZone } from 'date-fns-tz';

import { logError } from '@/lib/log';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { getServiceClient } from '@/lib/supabaseService';
import { TZ } from '@/lib/time';

import type { ActiveBookingRow } from './whatsappWebhookTypes';

export async function handleWhatsAppRemindCommand(
    fromPhone: string,
    activeBookings: ActiveBookingRow[],
    formatBookingLine: (booking: ActiveBookingRow, index: number) => string
) {
    try {
        if (activeBookings.length === 0) {
            await sendWhatsApp({
                to: fromPhone,
                text: 'У вас нет предстоящих бронирований. Для записи посетите наш сайт или напишите нам.',
            });
            return;
        }

        const lines = activeBookings.map((b, i) => formatBookingLine(b, i + 1)).join('\n');
        const header = activeBookings.length === 1
            ? 'Ваше ближайшее бронирование:\n\n'
            : `У вас ${activeBookings.length} предстоящих бронирований:\n\n`;

        await sendWhatsApp({
            to: fromPhone,
            text: header + lines + '\n\nКоманды: «отмена 1», «подтвердить 1», «помощь».',
        });
    } catch (error) {
        logError('WhatsAppWebhook', 'Failed to send remind message', { error, fromPhone });
    }
}

export async function handleWhatsAppHelpCommand(fromPhone: string, activeBookingsCount: number) {
    let helpText = 'Доступные команды:\n\n';
    helpText += '• "отмена" — отменить бронирование';
    if (activeBookingsCount > 1) helpText += ' (или "отмена 1", "отмена 2")';
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

export async function sendWhatsAppBookingInfo(fromPhone: string, bookingId: string) {
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

        const infoText = `Ваше бронирование:\n\n` +
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
