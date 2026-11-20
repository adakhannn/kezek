import { formatKyDate, formatLocalizedDate, KY_MONTHS, KY_WEEKDAYS } from '@/lib/kyDateFormat';

// 2026-11-20 is a Friday; 14:05 in Bishkek (UTC+6).
const instant = new Date('2026-11-20T08:05:00Z');
const tz = 'Asia/Bishkek';

describe('formatKyDate', () => {
    it.each([
        [{ day: 'numeric', month: 'long' }, '20-ноябрь'],
        [{ day: 'numeric', month: 'long', year: 'numeric' }, '2026-ж., 20-ноябрь'],
        [{ day: '2-digit', month: 'long', year: 'numeric' }, '2026-ж., 20-ноябрь'],
        [{ weekday: 'long', day: 'numeric', month: 'long' }, '20-ноябрь, жума'],
        [{ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, '2026-ж., 20-ноябрь, жума'],
        [{ month: 'long', year: 'numeric' }, '2026-ж., ноябрь'],
        [{ month: 'long' }, 'ноябрь'],
        [{ weekday: 'long' }, 'жума'],
        [{ day: '2-digit', month: '2-digit', year: 'numeric' }, '20.11.2026'],
        [{}, '20.11.2026'],
        [{ hour: '2-digit', minute: '2-digit' }, '14:05'],
        [{ day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }, '2026-ж., 20-ноябрь 14:05'],
        [{ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }, '20.11.2026 14:05'],
        [{ dateStyle: 'medium', timeStyle: 'short' }, '2026-ж., 20-ноябрь 14:05'],
        [{ dateStyle: 'full' }, '2026-ж., 20-ноябрь, жума'],
        [{ dateStyle: 'short' }, '20.11.2026'],
    ] as const)('formats %j as %s', (options, expected) => {
        expect(formatKyDate(instant, { ...options, timeZone: tz })).toBe(expected);
    });

    it('uses the given time zone at a UTC date boundary', () => {
        const lateUtc = new Date('2026-12-31T18:00:00Z');
        expect(formatKyDate(lateUtc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })).toBe('2027-ж., 1-январь');
        expect(formatKyDate(lateUtc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })).toBe('2026-ж., 31-декабрь');
    });

    it('uses the local calendar date when no time zone is given', () => {
        expect(formatKyDate(new Date(2026, 10, 20, 12), { weekday: 'long', day: 'numeric', month: 'long' })).toBe('20-ноябрь, жума');
    });

    it.each(KY_MONTHS.map((label, index) => [index, label] as const))('names month %i as %s', (index, label) => {
        expect(formatKyDate(new Date(Date.UTC(2026, index, 15, 6)), { day: 'numeric', month: 'long', timeZone: 'UTC' })).toBe(`15-${label}`);
    });

    it.each(KY_WEEKDAYS.map((label, index) => [19 + index, label] as const))('names the weekday of 2026-10-%i as %s', (day, label) => {
        expect(formatKyDate(new Date(Date.UTC(2026, 9, day, 6)), { weekday: 'long', timeZone: 'UTC' })).toBe(label);
    });

    it('returns Invalid Date for an invalid date, like toLocaleDateString', () => {
        expect(formatKyDate(new Date('nope'), { day: 'numeric', month: 'long' })).toBe('Invalid Date');
    });
});

describe('formatLocalizedDate', () => {
    const options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz } as const;

    it('uses the Kyrgyz formatter for ky', () => {
        expect(formatLocalizedDate(instant, 'ky', options)).toBe('2026-ж., 20-ноябрь');
    });

    it.each([
        ['ru', 'ru-RU', 'en-US'],
        ['en', 'en-US', 'en-US'],
        ['en', 'en-GB', 'en-GB'],
        ['de', 'ru-RU', 'en-US'],
    ] as const)('delegates %s to Intl %s', (locale, intlLocale, english) => {
        expect(formatLocalizedDate(instant, locale, options, english)).toBe(new Intl.DateTimeFormat(intlLocale, options).format(instant));
    });

    it('returns Invalid Date for an invalid date in every locale', () => {
        expect(formatLocalizedDate(new Date('nope'), 'ru')).toBe('Invalid Date');
        expect(formatLocalizedDate(new Date('nope'), 'ky')).toBe('Invalid Date');
    });
});
