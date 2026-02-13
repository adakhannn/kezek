/**
 * Unit-тесты для normalizePercentages
 */

import { normalizePercentages } from '@/lib/financeDomain/normalize';

describe('normalizePercentages', () => {
    test('должен нормализовать проценты, которые в сумме дают 100', () => {
        const result = normalizePercentages(60, 40);
        expect(result.master).toBe(60);
        expect(result.salon).toBe(40);
        expect(result.sum).toBe(100);
    });

    test('должен нормализовать проценты, которые в сумме не дают 100', () => {
        const result = normalizePercentages(30, 20);
        expect(result.master).toBe(60); // 30 / 50 * 100
        expect(result.salon).toBe(40); // 20 / 50 * 100
        expect(result.sum).toBe(100);
    });

    test('должен обработать нулевые проценты', () => {
        const result = normalizePercentages(0, 0);
        expect(result.master).toBe(0);
        expect(result.salon).toBe(0);
        expect(result.sum).toBe(100);
    });

    test('должен обработать отрицательные проценты (использует дефолтные значения)', () => {
        const result = normalizePercentages(-10, -20);
        expect(result.master).toBe(60); // Дефолтное значение
        expect(result.salon).toBe(40); // Дефолтное значение
        expect(result.sum).toBe(100);
    });

    test('должен обработать NaN значения (использует дефолтные значения)', () => {
        const result = normalizePercentages(NaN, NaN);
        expect(result.master).toBe(60);
        expect(result.salon).toBe(40);
        expect(result.sum).toBe(100);
    });

    test('должен обработать Infinity значения (использует дефолтные значения)', () => {
        const result = normalizePercentages(Infinity, Infinity);
        expect(result.master).toBe(60);
        expect(result.salon).toBe(40);
        expect(result.sum).toBe(100);
    });

    test('должен обработать очень большие проценты', () => {
        const result = normalizePercentages(200, 100);
        expect(result.master).toBeCloseTo(66.67, 2);
        expect(result.salon).toBeCloseTo(33.33, 2);
        expect(result.sum).toBe(100);
    });

    test('должен обработать дробные проценты', () => {
        const result = normalizePercentages(60.5, 39.5);
        expect(result.master).toBeCloseTo(60.5, 2);
        expect(result.salon).toBeCloseTo(39.5, 2);
        expect(result.sum).toBe(100);
    });
});

