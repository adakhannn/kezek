import { formatInTimeZone } from 'date-fns-tz';

import { TZ } from '@/lib/time';

type NamedValue = {
    name_ru?: string;
    full_name?: string;
    name?: string;
    address?: string | null;
};

export type WhatsAppBookingListItem = {
    start_at: string;
    services: NamedValue[] | NamedValue | null;
    staff: NamedValue[] | NamedValue | null;
};

export type WhatsAppBookingInfo = {
    status: string;
    start_at: string;
    end_at: string;
    services: NamedValue[] | NamedValue | null;
    staff: NamedValue[] | NamedValue | null;
    branches: NamedValue[] | NamedValue | null;
    businesses: NamedValue[] | NamedValue | null;
};

export function formatFirstWebhookValue<T extends NamedValue>(
    value: T[] | T | null | undefined,
    key: keyof T,
    fallback: string,
): string {
    if (Array.isArray(value)) {
        const first = value[0];
        return (first?.[key] as string | undefined) || fallback;
    }

    return (value?.[key] as string | undefined) || fallback;
}

export function formatBookingListLine(
    booking: WhatsAppBookingListItem,
    index: number,
): string {
    const serviceName = formatFirstWebhookValue(booking.services, 'name_ru', 'услуга');
    const staffName = formatFirstWebhookValue(booking.staff, 'full_name', 'мастер');
    const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');

    return `${index}. ${startTime} - ${serviceName}, ${staffName}`;
}

export function buildBookingChoiceText(
    kind: 'cancel' | 'confirm',
    activeBookings: WhatsAppBookingListItem[],
): string {
    const lines = activeBookings
        .map((booking, bookingIndex) => formatBookingListLine(booking, bookingIndex + 1))
        .join('\n');
    const command = kind === 'cancel' ? 'отмена' : 'подтвердить';

    return `У вас несколько бронирований:\n\n${lines}\n\nНапишите "${command} 1" или "${command} 2" для нужной записи.`;
}

export function buildRemindText(activeBookings: WhatsAppBookingListItem[]): string {
    const lines = activeBookings
        .map((booking, bookingIndex) => formatBookingListLine(booking, bookingIndex + 1))
        .join('\n');
    const header =
        activeBookings.length === 1
            ? 'Ваше ближайшее бронирование:\n\n'
            : `У вас ${activeBookings.length} предстоящих бронирований:\n\n`;

    return `${header}${lines}\n\nКоманды: "отмена 1", "подтвердить 1", "помощь".`;
}

export function buildHelpText(activeBookingsCount: number): string {
    let helpText = 'Доступные команды:\n\n';
    helpText += '• "отмена" - отменить бронирование';
    if (activeBookingsCount > 1) {
        helpText += ' (или "отмена 1", "отмена 2")';
    }
    helpText += '\n';
    helpText += '• "подтвердить" - подтвердить бронирование';
    if (activeBookingsCount > 1) {
        helpText += ' (или "подтвердить 1", "подтвердить 2")';
    }
    helpText += '\n';
    helpText += '• "напомни" - показать предстоящие записи\n';
    helpText += '• "помощь" - это сообщение\n\n';
    helpText +=
        activeBookingsCount > 0
            ? 'У вас есть активное бронирование. Используйте команды выше для управления им.'
            : 'Для новой записи воспользуйтесь сайтом или свяжитесь с нами.';

    return helpText;
}

export function formatBookingStatusText(status: string): string {
    switch (status) {
        case 'hold':
            return 'Ожидает подтверждения';
        case 'confirmed':
            return 'Подтверждено';
        case 'paid':
            return 'Оплачено';
        case 'cancelled':
            return 'Отменено';
        default:
            return status;
    }
}

export function buildBookingInfoText(booking: WhatsAppBookingInfo): string {
    const serviceName = formatFirstWebhookValue(booking.services, 'name_ru', 'услуга');
    const staffName = formatFirstWebhookValue(booking.staff, 'full_name', 'мастер');
    const branchName = formatFirstWebhookValue(booking.branches, 'name', 'филиал');
    const branchAddress = formatFirstWebhookValue(booking.branches, 'address', '');
    const businessName = formatFirstWebhookValue(booking.businesses, 'name', '');
    const startTime = formatInTimeZone(new Date(booking.start_at), TZ, 'dd.MM.yyyy HH:mm');
    const endTime = formatInTimeZone(new Date(booking.end_at), TZ, 'HH:mm');
    const statusText = formatBookingStatusText(booking.status);

    return (
        `Ваше бронирование:\n\n${statusText}\n\n` +
        `Услуга: ${serviceName}\n` +
        `Мастер: ${staffName}\n` +
        `Дата и время: ${startTime} - ${endTime}\n` +
        `Филиал: ${branchName}` +
        `${branchAddress ? `\nАдрес: ${branchAddress}` : ''}` +
        `${businessName ? `\n\n${businessName}` : ''}` +
        '\n\nКоманды: "отмена", "подтвердить", "помощь"'
    );
}
