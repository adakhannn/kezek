import { formatInTimeZone } from 'date-fns-tz';
import { enUS, ru } from 'date-fns/locale';

import { formatKyDate } from '../i18n/kyDate';
import type { Locale } from '../i18n/locale';
import { createTranslate } from '../i18n/translate';

import { resolveBusinessTimeZone } from '@shared-client/timezone';

/*
 * Every formatter takes the screen's language (`useLanguage().locale`); without it the text is
 * Russian. Kyrgyz goes through formatKyDate (no Intl 'ky-KG', which devices often lack). `timeZone` is the
 * business's businesses.tz when the data carries it; NULL or unknown means Asia/Bishkek (ARCH-11).
 */

/**
 * Форматирование даты и времени
 */
export function formatDateTime(date: string | Date, includeTime = true, locale: Locale = 'ru', timeZone?: string | null): string {
    const tz = resolveBusinessTimeZone(timeZone);
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (locale === 'ky') {
        return includeTime
            ? `${formatKyDate(dateObj, { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })}, ${formatTime(dateObj, tz)}`
            : formatKyDate(dateObj, { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
    }
    if (locale === 'en') {
        const pattern = includeTime ? 'MMMM d, yyyy, HH:mm' : 'MMMM d, yyyy';
        return formatInTimeZone(dateObj, tz, pattern, { locale: enUS });
    }
    // "5 декабря 2026": no leading zero, as the website's Intl day: 'numeric'.
    const pattern = includeTime ? 'd MMMM yyyy, HH:mm' : 'd MMMM yyyy';
    return formatInTimeZone(dateObj, tz, pattern, { locale: ru });
}

/**
 * Форматирование времени
 */
export function formatTime(date: string | Date, timeZone?: string | null): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatInTimeZone(dateObj, resolveBusinessTimeZone(timeZone), 'HH:mm', { locale: ru });
}

/**
 * Форматирование даты: «23 ноября 2026», ky «2026-ж., 23-ноябрь», en «November 23, 2026».
 */
export function formatDate(date: string | Date, locale: Locale = 'ru', timeZone?: string | null): string {
    return formatDateTime(date, false, locale, timeZone);
}

/**
 * A business calendar date (`YYYY-MM-DD`, e.g. a shift day or a package's last day) as formatDate
 * writes it, with no time zone shift: the date is a calendar day, not an instant.
 */
export function formatYmd(ymd: string, locale: Locale = 'ru'): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    return formatDate(new Date(`${ymd}T12:00:00Z`), locale, 'UTC');
}

/**
 * Форматирование относительного времени (сегодня, вчера, и т.д.)
 */
export function formatRelativeTime(date: string | Date, locale: Locale = 'ru'): string {
    const t = createTranslate(locale);
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('cabinet.format.justNow');
    if (diffMins < 60) return t('cabinet.format.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('cabinet.format.hoursAgo', { count: diffHours });
    if (diffDays === 1) return t('cabinet.format.yesterday');
    if (diffDays < 7) return t('cabinet.format.daysAgo', { count: diffDays });
    return formatDate(dateObj, locale);
}

/**
 * Форматирование номера телефона
 */
export function formatPhone(phone: string | null | undefined): string {
    if (!phone) return '';
    // Убираем все нецифровые символы кроме +
    const cleaned = phone.replace(/[^\d+]/g, '');
    // Если начинается с +996, форматируем как кыргызский номер
    if (cleaned.startsWith('+996')) {
        const number = cleaned.slice(4);
        if (number.length === 9) {
            return `+996 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
        }
    }
    return cleaned;
}

const NBSP = '\u00a0';

/**
 * A number with grouped thousands, the website's ru-RU / en-US toLocaleString: 12 345,5 (ru/ky,
 * a no-break space and a decimal comma) or 12,345.5 (en). Grouping is done here, not by Intl, so
 * every device shows the same text.
 */
export function formatNumber(value: number, locale: Locale, maxFractionDigits = 2): string {
    if (!Number.isFinite(value)) return '0';
    const negative = value < 0;
    const factor = 10 ** maxFractionDigits;
    const rounded = Math.round(Math.abs(value) * factor) / factor;
    const [whole, fraction = ''] = String(rounded).split('.');
    const separator = locale === 'en' ? ',' : NBSP;
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    const decimalMark = locale === 'en' ? '.' : ',';
    return `${negative && rounded !== 0 ? '-' : ''}${grouped}${fraction ? decimalMark + fraction : ''}`;
}

/**
 * Форматирование цены: «1 500 сом», en «1,500 som».
 */
export function formatPrice(price: number | null | undefined, locale: Locale = 'ru'): string {
    if (price === null || price === undefined) return '';
    const currency = createTranslate(locale)('cabinet.format.currency');
    return `${formatNumber(price, locale)} ${currency}`;
}
