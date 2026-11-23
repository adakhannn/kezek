import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

import { formatDateLabel as formatDateLabelShared, type PriceRange } from '@shared-client/formatters';
import type { Locale, Translate } from '../../i18n';
import { kyMonthName, kyWeekdayShort } from '../../i18n/kyDate';

export type BookingDateLabel = {
    day: number;
    month: string;
    weekday: string;
    /** Day and month together: "23 ноябрь", "23-ноябрь", "November 23". */
    dayMonth: string;
};

/**
 * A YYYY-MM-DD booking day in the app language. Russian keeps the shared formatter; Kyrgyz is
 * built without Intl (see i18n/kyDate.ts); English uses date-fns.
 */
export function formatBookingDateLabel(dateString: string, locale: Locale): BookingDateLabel {
    const date = new Date(`${dateString}T12:00:00`);

    if (locale === 'ky') {
        const day = date.getDate();
        const month = kyMonthName(date.getMonth() + 1);
        return { day, month, weekday: kyWeekdayShort(Number(format(date, 'i'))), dayMonth: `${day}-${month}` };
    }

    if (locale === 'en') {
        const day = date.getDate();
        const month = format(date, 'MMMM', { locale: enUS });
        return { day, month, weekday: format(date, 'EEE', { locale: enUS }), dayMonth: `${month} ${day}` };
    }

    const { day, month } = formatDateLabelShared(dateString, 'ru-RU');
    const weekday = date.toLocaleDateString('ru-RU', { weekday: 'short' });
    return {
        day,
        month,
        weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
        dayMonth: `${day} ${month}`,
    };
}

/**
 * A service price in the app language: "X - Y сом", "от X сом", "до Y сом", "X сом" or null.
 * `compact` gives the service list form: "X–Y сом", and "X сом" for a price "from X".
 */
export function formatBookingPrice(
    service: PriceRange | undefined | null,
    t: Translate,
    { compact = false }: { compact?: boolean } = {},
): string | null {
    if (!service) return null;
    const from = service.price_from;
    const to = service.price_to;
    if (from != null && to != null && from !== to) {
        return t(compact ? 'booking.price.rangeCompact' : 'booking.price.range', { from, to });
    }
    if (from != null) {
        return to != null || compact ? t('booking.price.value', { price: from }) : t('booking.price.from', { price: from });
    }
    if (to != null) return t('booking.price.upTo', { price: to });
    return null;
}
