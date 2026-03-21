import { addMinutes, addDays, isBefore, max as maxDate, min as minDate } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export { fromZonedTime };

/**
 * Получает таймзону из переменной окружения или возвращает значение по умолчанию
 * Централизованный доступ к таймзоне для всего приложения
 */
export function getTimezone(): string {
    return process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';
}

/**
 * Текущая календарная дата в заданной таймзоне (YYYY-MM-DD).
 * Использовать вместо new Date().toISOString().slice(0, 10) для «сегодня» в бизнес-логике.
 */
export function todayDateString(timezone?: string): string {
    const tz = timezone || getTimezone();
    return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}

/**
 * Календарная дата (YYYY-MM-DD) для произвольного момента в заданной таймзоне.
 */
export function toDateString(d: Date, timezone?: string): string {
    const tz = timezone || getTimezone();
    return formatInTimeZone(d, tz, 'yyyy-MM-dd');
}

/**
 * Текущая календарная дата (yyyy-MM-dd) в заданной таймзоне.
 * Алиас для единообразного использования по коду вместо formatInTimeZone(new Date(), tz, 'yyyy-MM-dd').
 */
export function todayStringInTz(tz: string): string {
    return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}

/**
 * Календарная дата (yyyy-MM-dd) для произвольного Date в заданной таймзоне.
 * Алиас для единообразного использования вместо formatInTimeZone(date, tz, 'yyyy-MM-dd').
 */
export function formatDateInTz(date: Date, tz: string): string {
    return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

/**
 * Добавляет дни к календарной дате (YYYY-MM-DD) в заданной таймзоне, возвращает YYYY-MM-DD.
 * Использовать для вычисления начальной даты диапазона (например, «сегодня минус 30 дней»).
 */
export function addDaysToDateString(dateStr: string, days: number, timezone?: string): string {
    const tz = timezone || getTimezone();
    const d = fromZonedTime(`${dateStr}T12:00:00`, tz);
    return formatInTimeZone(addDays(d, days), tz, 'yyyy-MM-dd');
}

/**
 * Список календарных дат (YYYY-MM-DD) от start до end включительно в заданной таймзоне.
 */
export function dateRangeInclusive(startStr: string, endStr: string, timezone?: string): string[] {
    const tz = timezone || getTimezone();
    const res: string[] = [];
    let cur = startStr;
    while (cur <= endStr) {
        res.push(cur);
        cur = addDaysToDateString(cur, 1, tz);
    }
    return res;
}

/**
 * Получает таймзону бизнеса, если она указана, иначе использует дефолтную таймзону
 * @param businessTz - таймзона бизнеса из базы данных (может быть null или undefined)
 * @returns таймзона бизнеса или дефолтная таймзона
 */
export function getBusinessTimezone(businessTz?: string | null): string {
    if (businessTz && businessTz.trim()) {
        return businessTz.trim();
    }
    return getTimezone();
}

/**
 * Экспорт таймзоны для обратной совместимости
 * @deprecated Используйте getTimezone() или getBusinessTimezone() для получения таймзоны
 */
export const TZ = getTimezone();

export function todayTz(timezone?: string): Date {
    const tz = timezone || TZ;
    const now = new Date();
    // нормализуем на 00:00 в TZ
    const s = formatInTimeZone(now, tz, 'yyyy-MM-dd') + 'T00:00:00';
    return fromZonedTime(s, tz);
}

export function dateAtTz(ymd: string, hhmm: string, timezone?: string): Date {
    const tz = timezone || TZ;
    const s = `${ymd}T${hhmm}:00`;
    return fromZonedTime(s, tz);
}

export function toLabel(d: Date, timezone?: string) {
    const tz = timezone || TZ;
    return formatInTimeZone(d, tz, 'HH:mm');
}

export function rangeClip(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    const start = maxDate([aStart, bStart]); // ← передаём массив
    const end   = minDate([aEnd, bEnd]);     // ← передаём массив

    // Если нужно считать касание границ пересечением, используем <=:
    // return (isBefore(start, end) || isEqual(start, end)) ? [start, end] : null;

    // Если нужна строго положительная длина:
    return isBefore(start, end) ? [start, end] : null;
}

export function enumerateSlots(winStart: Date, winEnd: Date, serviceMin: number, stepMin = 15) {
    const res: Date[] = [];
    for (let t = new Date(winStart); isBefore(addMinutes(t, serviceMin - 1), winEnd); t = addMinutes(t, stepMin)) {
        res.push(new Date(t));
    }
    return res;
}