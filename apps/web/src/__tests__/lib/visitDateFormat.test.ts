import { formatVisitDateRange, formatVisitDay, formatVisitTimeRange } from '@/lib/visitDateFormat';

const TZ = 'Asia/Bishkek';
const NOW = new Date('2026-11-28T06:00:00Z');

describe('formatVisitDateRange (owner format «27 нояб. • 09:00–10:00»)', () => {
    test.each([
        ['ru', '27 нояб. • 09:00–10:00'],
        ['ky', '27-ноя. • 09:00–10:00'],
        ['en', 'Nov 27 • 09:00–10:00'],
    ] as const)('formats a visit of the current year in %s', (locale, expected) => {
        expect(formatVisitDateRange('2026-11-27T03:00:00Z', '2026-11-27T04:00:00Z', TZ, locale, NOW)).toBe(expected);
    });

    test.each([
        ['ru', '5 мая 2027 • 10:00–11:30'],
        ['ky', '2027-ж., 5-май • 10:00–11:30'],
        ['en', 'May 5, 2027 • 10:00–11:30'],
    ] as const)('adds the year (without «г.») for another year in %s', (locale, expected) => {
        expect(formatVisitDateRange('2027-05-05T04:00:00Z', '2027-05-05T05:30:00Z', TZ, locale, NOW)).toBe(expected);
    });

    test('uses the business time zone for both the day and the clock', () => {
        // 20:15 UTC on 18 Oct is 02:15 on 19 Oct in Bishkek.
        expect(formatVisitDateRange('2026-10-18T20:15:00Z', '2026-10-18T21:15:00Z', TZ, 'ru', NOW)).toBe('19 окт. • 02:15–03:15');
    });

    test('never prints a time-zone name, «г.», a spaced hyphen or a numeric date', () => {
        const text = formatVisitDateRange('2026-01-02T03:00:00Z', '2026-01-02T04:00:00Z', TZ, 'ru', NOW);
        expect(text).toBe('2 янв. • 09:00–10:00');
        expect(text).not.toMatch(/Asia|г\.|\s-\s|\d{2}\.\d{2}\.\d{4}/);
    });

    test('shows only the start time when the end is missing or not after the start', () => {
        expect(formatVisitTimeRange('2026-11-27T03:00:00Z', null, TZ)).toBe('09:00');
        expect(formatVisitTimeRange('2026-11-27T03:00:00Z', '2026-11-27T03:00:00Z', TZ)).toBe('09:00');
        expect(formatVisitDateRange('2026-11-27T03:00:00Z', undefined, TZ, 'ru', NOW)).toBe('27 нояб. • 09:00');
    });

    test('returns an empty string for an invalid date instead of «Invalid Date»', () => {
        expect(formatVisitDay('not-a-date', TZ, 'ru', NOW)).toBe('');
        expect(formatVisitDateRange('not-a-date', null, TZ, 'ru', NOW)).toBe('');
    });
});
