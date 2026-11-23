import { formatInTimeZone } from 'date-fns-tz';
import { enUS, ru } from 'date-fns/locale';

import { formatKyDate } from '../i18n/kyDate';
import type { Locale } from '../i18n/locale';
import { createTranslate } from '../i18n/translate';

const TZ = 'Asia/Bishkek';

/*
 * Every formatter takes the screen's language (`useLanguage().locale`); without it the text is
 * Russian. Kyrgyz goes through formatKyDate (no Intl 'ky-KG', which devices often lack).
 */

/**
 * Форматирование даты и времени
 */
export function formatDateTime(date: string | Date, includeTime = true, locale: Locale = 'ru'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (locale === 'ky') {
        return includeTime
            ? `${formatKyDate(dateObj, { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })}, ${formatTime(dateObj)}`
            : formatKyDate(dateObj, { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
    }
    if (locale === 'en') {
        const pattern = includeTime ? 'MMMM d, yyyy, HH:mm' : 'MMMM d, yyyy';
        return formatInTimeZone(dateObj, TZ, pattern, { locale: enUS });
    }
    const pattern = includeTime ? 'dd MMMM yyyy, HH:mm' : 'dd MMMM yyyy';
    return formatInTimeZone(dateObj, TZ, pattern, { locale: ru });
}

/**
 * Форматирование времени
 */
export function formatTime(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatInTimeZone(dateObj, TZ, 'HH:mm', { locale: ru });
}

/**
 * Форматирование даты: «23 ноября 2026», ky «2026-ж., 23-ноябрь», en «November 23, 2026».
 */
export function formatDate(date: string | Date, locale: Locale = 'ru'): string {
    return formatDateTime(date, false, locale);
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

/**
 * Форматирование цены: «1 500 сом», en «1,500 som».
 */
export function formatPrice(price: number | null | undefined, locale: Locale = 'ru'): string {
    if (price === null || price === undefined) return '';
    const currency = createTranslate(locale)('cabinet.format.currency');
    return `${price.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')} ${currency}`;
}
