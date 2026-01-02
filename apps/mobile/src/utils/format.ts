import { format, formatInTimeZone } from 'date-fns-tz';
import { ru } from 'date-fns/locale';

const TZ = 'Asia/Bishkek';

/**
 * Форматирование даты и времени
 */
export function formatDateTime(date: string | Date, includeTime = true): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
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
 * Форматирование даты
 */
export function formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatInTimeZone(dateObj, TZ, 'dd MMMM yyyy', { locale: ru });
}

/**
 * Форматирование относительного времени (сегодня, вчера, и т.д.)
 */
export function formatRelativeTime(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return formatDate(dateObj);
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
 * Форматирование цены
 */
export function formatPrice(price: number | null | undefined, currency = 'сом'): string {
    if (price === null || price === undefined) return '';
    return `${price.toLocaleString('ru-RU')} ${currency}`;
}

