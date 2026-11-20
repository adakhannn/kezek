/**
 * Утилиты для форматирования дат с учетом локали
 */

import { enUS, ru, type Locale as DateFnsLocale } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

import { formatLocalizedDate } from './kyDateFormat';
import { TZ } from './time';

type Locale = 'ru' | 'ky' | 'en';

// date-fns не имеет ky-локали. Шаблоны ниже только числовые (dd.MM.yyyy HH:mm),
// поэтому локаль date-fns на них не влияет; названия месяцев для ky даёт kyDateFormat.
const localeMap: Record<Locale, DateFnsLocale> = {
    ru: ru,
    ky: ru, // numeric patterns only: identical output
    en: enUS,
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
        return formatLocalizedDate(date, locale, {
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
        return formatLocalizedDate(date, locale, {
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

