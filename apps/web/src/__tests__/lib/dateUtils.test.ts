/**
 * Тесты для нормализации календарных дат (DATE_HANDLING_MODEL).
 */

import { toNormalizedDateString } from '@/lib/dateUtils';

describe('toNormalizedDateString', () => {
    test('возвращает YYYY-MM-DD как есть', () => {
        expect(toNormalizedDateString('2025-03-05')).toBe('2025-03-05');
        expect(toNormalizedDateString('2024-12-31')).toBe('2024-12-31');
    });

    test('берёт первые 10 символов из ISO datetime (без сдвига по TZ)', () => {
        // "2025-03-05T23:00:00" без Z — в UTC могло бы стать 2025-03-04; мы храним 2025-03-05
        expect(toNormalizedDateString('2025-03-05T23:00:00')).toBe('2025-03-05');
        expect(toNormalizedDateString('2025-03-05T00:00:00.000Z')).toBe('2025-03-05');
        expect(toNormalizedDateString('2025-03-05T12:30:00+06:00')).toBe('2025-03-05');
    });

    test('возвращает null для null/undefined/пустой строки', () => {
        expect(toNormalizedDateString(null)).toBeNull();
        expect(toNormalizedDateString(undefined)).toBeNull();
        expect(toNormalizedDateString('')).toBeNull();
        expect(toNormalizedDateString('   ')).toBeNull();
    });

    test('возвращает null для невалидной строки', () => {
        expect(toNormalizedDateString('05.03.2025')).toBeNull();
        expect(toNormalizedDateString('not-a-date')).toBeNull();
        expect(toNormalizedDateString('2025')).toBeNull();
        expect(toNormalizedDateString('2025-3-5')).toBeNull(); // одна цифра в месяце/дне
    });

    test('обрезает пробелы в начале и берёт дату', () => {
        expect(toNormalizedDateString('  2025-03-05  ')).toBe('2025-03-05');
    });
});
