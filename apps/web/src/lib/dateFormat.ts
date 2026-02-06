/**
 * Утилиты для форматирования дат с учетом локали
 */

import { enUS, ru, type Locale as DateFnsLocale } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

import { TZ } from './time';

type Locale = 'ru' | 'ky' | 'en';

// Для киргизской локали используем русскую как fallback (date-fns не имеет встроенной ky локали)
const localeMap: Record<Locale, DateFnsLocale> = {
    ru: ru,
    ky: ru, // Fallback to Russian for Kyrgyz
    en: enUS,
};

const browserLocaleMap: Record<Locale, string> = {
    ru: 'ru-RU',
    ky: 'ky-KG',
    en: 'en-US',
};

/**
 * Форматирует дату в формате DD.MM.YYYY с учетом локали
 */
export function formatDate(dateStr: string, locale: Locale = 'ru'): string {
    try {
        // Если дата в формате YYYY-MM-DD, добавляем время для корректного парсинга
        const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00');
        return formatInTimeZone(date, TZ, 'dd.MM.yyyy', { locale: localeMap[locale] });
    } catch {
        return dateStr;
    }
}

/**
 * Форматирует дату для отображения в браузере (с учетом локали браузера)
 */
export function formatDateBrowser(dateStr: string, locale: Locale = 'ru'): string {
    try {
        const date = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00');
        return date.toLocaleDateString(browserLocaleMap[locale], {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

/**
 * Форматирует месяц и год (например, "январь 2024")
 */
export function formatMonthYear(dateStr: string, locale: Locale = 'ru'): string {
    try {
        const [year, month] = dateStr.split('-');
        const date = new Date(`${year}-${month}-01`);
        return date.toLocaleDateString(browserLocaleMap[locale], {
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

/**
 * Форматирует дату и время (например, "26.01.2024 14:30")
 */
export function formatDateTime(dateStr: string | Date, locale: Locale = 'ru', includeTime = true): string {
    try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        const pattern = includeTime ? 'dd.MM.yyyy HH:mm' : 'dd.MM.yyyy';
        return formatInTimeZone(date, TZ, pattern, { locale: localeMap[locale] });
    } catch {
        return typeof dateStr === 'string' ? dateStr : dateStr.toISOString();
    }
}

/**
 * Форматирует только время (например, "14:30")
 */
export function formatTime(dateStr: string | Date, locale: Locale = 'ru'): string {
    try {
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return formatInTimeZone(date, TZ, 'HH:mm', { locale: localeMap[locale] });
    } catch {
        return typeof dateStr === 'string' ? dateStr : dateStr.toISOString();
    }
}

