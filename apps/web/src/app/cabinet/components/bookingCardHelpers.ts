import { formatInTimeZone } from 'date-fns-tz';

import type { BookingTimelineStepKey } from '@core-domain/booking';
import { transliterate } from '@/lib/transliterate';

type Translator = (key: string, fallback?: string) => string;

export const bookingCardLocaleMap: Record<string, string> = {
    ky: 'ru-KG',
    ru: 'ru-RU',
    en: 'en-US',
};

export function getBookingServiceName(
    service: { name_ru: string; name_ky?: string | null; name_en?: string | null } | null,
    locale: string,
    t: Translator,
) {
    if (!service) return t('cabinet.bookings.card.service', 'Услуга');
    if (locale === 'ky' && service.name_ky) return service.name_ky;
    if (locale === 'en' && service.name_en) return service.name_en;
    return service.name_ru;
}

export function getBookingStaffName(name: string | null | undefined, locale: string, t: Translator) {
    if (!name) return t('cabinet.bookings.card.masterNotSet', 'Мастер не указан');
    if (locale === 'en') return transliterate(name);
    return name;
}

export function getBookingWhen(startAt: string, endAt: string, timezone: string, locale: string) {
    const dateFormatter = new Intl.DateTimeFormat(bookingCardLocaleMap[locale] || 'ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
    });

    const timeFormatter = new Intl.DateTimeFormat(bookingCardLocaleMap[locale] || 'ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
    });

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    return `${dateFormatter.format(startDate)} — ${timeFormatter.format(endDate)}`;
}

export function getRepeatBookingStoragePayload(args: {
    effectiveBizId: string;
    effectiveBranchId: string;
    effectiveServiceId: string;
    effectiveStaffId: string;
    startAt: string;
    timezone: string;
}) {
    return {
        key: `booking_state_${args.effectiveBizId}`,
        payload: {
            branchId: args.effectiveBranchId,
            serviceId: args.effectiveServiceId,
            staffId: args.effectiveStaffId,
            day: formatInTimeZone(new Date(args.startAt), args.timezone, 'yyyy-MM-dd'),
            step: 4,
        },
    };
}

export function getBookingStatusMeta(status: 'hold' | 'confirmed' | 'paid' | 'cancelled', t: Translator) {
    return {
        color: {
            hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        }[status],
        dotColor: {
            paid: 'bg-green-500',
            confirmed: 'bg-blue-500',
            hold: 'bg-yellow-500',
            cancelled: 'bg-red-500',
        }[status],
        label: {
            hold: t('cabinet.bookings.card.status.hold', 'Ожидает подтверждения'),
            confirmed: t('cabinet.bookings.card.status.confirmed', 'Подтверждена'),
            paid: t('cabinet.bookings.card.status.paid', 'Оплачена'),
            cancelled: t('cabinet.bookings.card.status.cancelled', 'Отменена'),
        }[status],
    };
}

export function getBookingTimelineLabel(stepKey: BookingTimelineStepKey, t: Translator) {
    switch (stepKey) {
        case 'created':
            return t('cabinet.bookings.timeline.created', 'Создано');
        case 'confirmed':
            return t('cabinet.bookings.timeline.confirmed', 'Подтверждено');
        case 'completed':
            return t('cabinet.bookings.timeline.completed', 'Завершено');
        case 'cancelled':
            return t('cabinet.bookings.timeline.cancelled', 'Отменено');
        case 'no_show':
            return t('cabinet.bookings.card.status.no_show', 'Не пришёл');
        case 'promo':
            return t('cabinet.bookings.timeline.promo', 'Промо применено');
        default:
            return '';
    }
}
