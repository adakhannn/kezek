import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addMinutes, isBefore, max as maxDate, min as minDate } from 'date-fns';

export const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export function todayTz(): Date {
    const now = new Date();
    // нормализуем на 00:00 в TZ
    const s = formatInTimeZone(now, TZ, 'yyyy-MM-dd') + 'T00:00:00';
    return fromZonedTime(s, TZ);
}

export function dateAtTz(ymd: string, hhmm: string): Date {
    const s = `${ymd}T${hhmm}:00`;
    return fromZonedTime(s, TZ);
}

export function toLabel(d: Date) {
    return formatInTimeZone(d, TZ, 'HH:mm');
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