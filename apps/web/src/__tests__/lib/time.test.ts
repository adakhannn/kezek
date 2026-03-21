/**
 * Тесты для календарных дат в таймзоне (todayDateString, toDateString, addDaysToDateString, dateRangeInclusive).
 */

import {
  addDaysToDateString,
  dateRangeInclusive,
  getTimezone,
  todayDateString,
  toDateString,
} from '@/lib/time';

describe('todayDateString', () => {
    test('возвращает строку формата YYYY-MM-DD', () => {
        const result = todayDateString();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('с заданной таймзоной возвращает YYYY-MM-DD', () => {
        const result = todayDateString('Asia/Bishkek');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('toDateString', () => {
    test('переводит Date в календарную дату в таймзоне', () => {
        // 2025-03-05 02:00 UTC = в Asia/Bishkek (UTC+6) ещё 2025-03-05 08:00
        const d = new Date('2025-03-05T02:00:00.000Z');
        expect(toDateString(d, 'UTC')).toBe('2025-03-05');
        expect(toDateString(d, 'Asia/Bishkek')).toBe('2025-03-05');
    });

    test('на границе дня: вечер UTC уже следующий день в UTC+12', () => {
        // 2025-03-05 15:00 UTC = 2025-03-06 03:00 в Pacific/Auckland (UTC+12)
        const d = new Date('2025-03-05T15:00:00.000Z');
        expect(toDateString(d, 'UTC')).toBe('2025-03-05');
        expect(toDateString(d, 'Pacific/Auckland')).toBe('2025-03-06');
    });

    test('на границе дня: раннее утро UTC — в Americas ещё вчера', () => {
        // 2025-03-05 02:00 UTC = 2025-03-04 21:00 в America/Los_Angeles (UTC-7)
        const d = new Date('2025-03-05T02:00:00.000Z');
        expect(toDateString(d, 'UTC')).toBe('2025-03-05');
        expect(toDateString(d, 'America/Los_Angeles')).toBe('2025-03-04');
    });
});

describe('addDaysToDateString', () => {
    test('добавляет дни в заданной таймзоне', () => {
        expect(addDaysToDateString('2025-03-15', 0, 'UTC')).toBe('2025-03-15');
        expect(addDaysToDateString('2025-03-15', 1, 'UTC')).toBe('2025-03-16');
        expect(addDaysToDateString('2025-03-15', -30, 'UTC')).toBe('2025-02-13');
        expect(addDaysToDateString('2025-03-01', -1, 'UTC')).toBe('2025-02-28');
    });

    test('переход через границу месяца/года', () => {
        expect(addDaysToDateString('2025-12-31', 1, 'UTC')).toBe('2026-01-01');
        expect(addDaysToDateString('2025-01-01', -1, 'UTC')).toBe('2024-12-31');
    });
});

describe('dateRangeInclusive', () => {
    test('возвращает один день если start === end', () => {
        expect(dateRangeInclusive('2025-03-10', '2025-03-10', 'UTC')).toEqual(['2025-03-10']);
    });

    test('возвращает диапазон дат включительно', () => {
        expect(dateRangeInclusive('2025-03-08', '2025-03-10', 'UTC')).toEqual([
            '2025-03-08',
            '2025-03-09',
            '2025-03-10',
        ]);
    });

    test('пустой массив если start > end не ожидается (цикл не выполнится)', () => {
        const r = dateRangeInclusive('2025-03-10', '2025-03-08', 'UTC');
        expect(r).toEqual([]);
    });
});

describe('getTimezone', () => {
    const orig = process.env.NEXT_PUBLIC_TZ;
    afterEach(() => {
        process.env.NEXT_PUBLIC_TZ = orig;
    });

    test('возвращает NEXT_PUBLIC_TZ если задан', () => {
        process.env.NEXT_PUBLIC_TZ = 'Europe/Moscow';
        expect(getTimezone()).toBe('Europe/Moscow');
    });

    test('возвращает Asia/Bishkek по умолчанию', () => {
        delete process.env.NEXT_PUBLIC_TZ;
        expect(getTimezone()).toBe('Asia/Bishkek');
    });
});
