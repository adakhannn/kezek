import { formatVisitDate, formatVisitRange, formatVisitWhen } from '@shared-client/visitFormat';

// 2026-11-27 10:00 and 11:00 in Bishkek (UTC+6).
const START = '2026-11-27T04:00:00Z';
const END = '2026-11-27T05:00:00Z';
const NOW = new Date('2026-11-28T06:00:00Z');

describe('owner visit format', () => {
    test.each([
        ['ru', '27 нояб. • 10:00–11:00'],
        ['ky', '27-ноябрь • 10:00–11:00'],
        ['en', 'Nov 27 • 10:00–11:00'],
    ] as const)('%s: day and range with an en dash and no spaces', (locale, expected) => {
        expect(formatVisitWhen(START, END, locale, 'Asia/Bishkek', NOW)).toBe(expected);
    });

    test.each([
        ['ru', '27 нояб. • 19:00'],
        ['ky', '27-ноябрь • 19:00'],
        ['en', 'Nov 27 • 19:00'],
    ] as const)('%s: a start without an end gives one time', (locale, expected) => {
        expect(formatVisitWhen('2026-11-27T13:00:00Z', null, locale, null, NOW)).toBe(expected);
    });

    test.each([
        ['ru', '5 мая 2025'],
        ['ky', '2025-ж., 5-май'],
        ['en', 'May 5, 2025'],
    ] as const)('%s: the year appears only for another year', (locale, expected) => {
        expect(formatVisitDate('2025-05-05T06:00:00Z', locale, 'Asia/Bishkek', NOW)).toBe(expected);
    });

    test('the day follows the business zone, not UTC', () => {
        // 20:15 UTC on the 18th is 02:15 on the 19th in Bishkek.
        expect(formatVisitDate('2026-10-18T20:15:00Z', 'ru', 'Asia/Bishkek', NOW)).toBe('19 окт.');
        expect(formatVisitDate('2026-10-18T20:15:00Z', 'ru', 'UTC', NOW)).toBe('18 окт.');
    });

    test('an unknown zone falls back to Asia/Bishkek', () => {
        expect(formatVisitRange(START, END, 'Mars/Olympus')).toBe('10:00–11:00');
    });

    test('a broken or earlier end is dropped', () => {
        expect(formatVisitRange(START, 'not a date', null)).toBe('10:00');
        expect(formatVisitRange(START, START, null)).toBe('10:00');
    });

    test('Russian months use the genitive abbreviations', () => {
        const months = Array.from({ length: 12 }, (_, i) =>
            formatVisitDate(new Date(Date.UTC(2026, i, 15, 6)), 'ru', 'Asia/Bishkek', NOW));
        expect(months).toEqual([
            '15 янв.', '15 февр.', '15 мар.', '15 апр.', '15 мая', '15 июн.',
            '15 июл.', '15 авг.', '15 сент.', '15 окт.', '15 нояб.', '15 дек.',
        ]);
    });
});
