import { getTimezoneOffset } from 'date-fns-tz';

/**
 * Business time zones (ARCH-11).
 *
 * Every business-facing time (slots, "today", working hours, shift days, notification texts, the
 * cabinet's booking times) belongs to the business's own zone, `businesses.tz`. NULL, an empty or an
 * unknown value means Asia/Bishkek, the zone of every business so far.
 */

/** The zone of a business whose `tz` is NULL, empty or unknown. */
export const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Bishkek';

const validity = new Map<string, boolean>();

/** True when the runtime's Intl knows the IANA zone (as PostgreSQL's private.is_valid_time_zone does). */
export function isValidTimeZone(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const tz = value.trim();
    if (!tz || tz !== value || tz.length > 64) return false;
    const known = validity.get(tz);
    if (known !== undefined) return known;
    let ok = true;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(0);
    } catch {
        ok = false;
    }
    validity.set(tz, ok);
    return ok;
}

/** The business's zone: `tz` when it is a known zone, otherwise Asia/Bishkek. */
export function resolveBusinessTimeZone(tz: string | null | undefined): string {
    const trimmed = typeof tz === 'string' ? tz.trim() : '';
    return trimmed && isValidTimeZone(trimmed) ? trimmed : DEFAULT_BUSINESS_TIME_ZONE;
}

/**
 * Zones offered by the business settings select. The server accepts any zone Intl knows; this list
 * only keeps the select short (the region the product serves, then common neighbours).
 */
export const BUSINESS_TIME_ZONE_OPTIONS: readonly string[] = [
    'Asia/Bishkek',
    'Asia/Almaty',
    'Asia/Qostanay',
    'Asia/Aqtobe',
    'Asia/Aqtau',
    'Asia/Atyrau',
    'Asia/Oral',
    'Asia/Qyzylorda',
    'Asia/Tashkent',
    'Asia/Samarkand',
    'Asia/Dushanbe',
    'Asia/Ashgabat',
    'Asia/Baku',
    'Asia/Tbilisi',
    'Asia/Yerevan',
    'Europe/Moscow',
    'Europe/Samara',
    'Asia/Yekaterinburg',
    'Asia/Omsk',
    'Asia/Novosibirsk',
    'Asia/Krasnoyarsk',
    'Asia/Irkutsk',
    'Asia/Urumqi',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Europe/Istanbul',
    'Europe/Minsk',
    'Europe/Berlin',
    'Europe/London',
    'America/New_York',
    'UTC',
];

/** "UTC+06:00" for `tz` at `at` (the offset can change with DST). */
export function formatUtcOffset(tz: string, at: Date = new Date()): string {
    const minutes = Math.round(getTimezoneOffset(tz, at) / 60000);
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `UTC${sign}${hh}:${mm}`;
}
