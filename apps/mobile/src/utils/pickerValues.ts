import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';

import { formatKyDate } from '../i18n/kyDate';
import type { Locale } from '../i18n/locale';

/*
 * Values of the native date and time pickers. A business date is `YYYY-MM-DD` and a time of day
 * is `HH:MM` on the business clock (businesses.tz). The native picker works with device-local
 * Date objects, so a value is carried as a local date with the same calendar fields: the picked
 * day/time is read back field by field and no time zone conversion can shift it.
 */

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const HM = /^(\d{1,2}):(\d{2})$/;

export function isYmd(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const match = YMD.exec(value);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.toISOString().slice(0, 10) === value;
}

export function isHm(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const match = HM.exec(value);
    return !!match && Number(match[1]) < 24 && Number(match[2]) < 60;
}

/** `YYYY-MM-DD` -> a device-local Date at noon of that calendar day (noon avoids DST edges). */
export function ymdToPickerDate(ymd: string): Date {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** The calendar day the picker returned, as `YYYY-MM-DD`. */
export function pickerDateToYmd(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `HH:MM` -> a device-local Date of an arbitrary day at that time. */
export function hmToPickerDate(hm: string): Date {
    const [hours, minutes] = hm.split(':').map(Number);
    return new Date(2000, 0, 1, hours || 0, minutes || 0, 0, 0);
}

/** The time the picker returned, as `HH:MM`. */
export function pickerDateToHm(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Keeps a date inside [min, max] (either bound may be empty). */
export function clampYmd(ymd: string, min?: string, max?: string): string {
    if (min && ymd < min) return min;
    if (max && ymd > max) return max;
    return ymd;
}

/**
 * The label of a business date in the app language: "Ср, 26 ноября 2026", "Wed, Nov 26, 2026",
 * "2026-ж., 26-ноябрь, шаршемби". `year: false` drops the year (a date of the current year).
 */
export function formatYmdLabel(ymd: string, locale: Locale, options: { weekday?: boolean; year?: boolean } = {}): string {
    if (!isYmd(ymd)) return '';
    const { weekday = true, year = true } = options;
    const local = ymdToPickerDate(ymd);
    if (locale === 'ky') {
        return formatKyDate(new Date(`${ymd}T12:00:00Z`), {
            day: 'numeric',
            month: 'long',
            ...(year ? { year: 'numeric' as const } : {}),
            ...(weekday ? { weekday: 'long' as const } : {}),
            timeZone: 'UTC',
        });
    }
    if (locale === 'en') {
        const pattern = [weekday ? 'EEE, ' : '', 'MMM d', year ? ', yyyy' : ''].join('');
        return format(local, pattern, { locale: enUS });
    }
    const pattern = [weekday ? 'EEEEEE, ' : '', 'd MMMM', year ? ' yyyy' : ''].join('');
    const text = format(local, pattern, { locale: ru });
    return text.charAt(0).toUpperCase() + text.slice(1);
}
