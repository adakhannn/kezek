/**
 * Общие форматтеры дат, времени и цен для web и mobile.
 * Единообразное отображение в бронировании и карточках.
 */

import { formatInTimeZone } from 'date-fns-tz';

/**
 * Форматирует время из ISO-строки в заданной таймзоне (HH:mm).
 */
export function formatTimeSlot(isoDateString: string, timezone: string): string {
    const date = new Date(isoDateString);
    return formatInTimeZone(date, timezone, 'HH:mm');
}

/**
 * Локаль для месяца (ru-RU, en-US и т.д.).
 */
export type DateLocale = 'ru-RU' | 'en-US' | 'ky-KG';

/**
 * Разбивает дату YYYY-MM-DD на день и название месяца для отображения.
 */
export function formatDateLabel(
    dateStr: string,
    locale: DateLocale = 'ru-RU',
): { day: number; month: string } {
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate();
    const month = date.toLocaleDateString(locale, { month: 'long' });
    return { day, month };
}

export type PriceRange = {
    price_from?: number | null;
    price_to?: number | null;
};

/**
 * Форматирует цену услуги: "X - Y сом", "от X сом" или null.
 *
 * @param service - объект с price_from и price_to (или два числа)
 * @param currency - подпись валюты, по умолчанию "сом"
 */
export function formatServicePrice(
    service: PriceRange | undefined | null,
    currency: string = 'сом',
): string | null {
    if (!service) return null;
    const from = service.price_from;
    const to = service.price_to;
    if (from != null && to != null && from !== to) {
        return `${from} - ${to} ${currency}`;
    }
    if (from != null) {
        return to != null && to === from ? `${from} ${currency}` : `от ${from} ${currency}`;
    }
    if (to != null) {
        return `до ${to} ${currency}`;
    }
    return null;
}
