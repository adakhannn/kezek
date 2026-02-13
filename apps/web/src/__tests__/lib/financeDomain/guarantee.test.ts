/**
 * Unit-тесты для расчета гарантированной суммы и доплаты
 */

import {
    calculateGuaranteedAmount,
    calculateTopupAmount,
} from '@/lib/financeDomain/guarantee';

describe('calculateGuaranteedAmount', () => {
    test('должен рассчитать гарантированную сумму', () => {
        expect(calculateGuaranteedAmount(8, 500)).toBe(4000);
        expect(calculateGuaranteedAmount(8.5, 500)).toBe(4250);
        expect(calculateGuaranteedAmount(4, 1000)).toBe(4000);
    });

    test('должен округлить результат до 2 знаков', () => {
        expect(calculateGuaranteedAmount(8.333, 500)).toBe(4166.5);
        expect(calculateGuaranteedAmount(7.777, 500)).toBe(3888.5);
    });

    test('должен вернуть 0 для null часов', () => {
        expect(calculateGuaranteedAmount(null, 500)).toBe(0);
    });

    test('должен вернуть 0 для null ставки', () => {
        expect(calculateGuaranteedAmount(8, null)).toBe(0);
    });

    test('должен вернуть 0 для нулевых значений', () => {
        expect(calculateGuaranteedAmount(0, 500)).toBe(0);
        expect(calculateGuaranteedAmount(8, 0)).toBe(0);
    });

    test('должен вернуть 0 для отрицательных значений', () => {
        expect(calculateGuaranteedAmount(-8, 500)).toBe(0);
        expect(calculateGuaranteedAmount(8, -500)).toBe(0);
    });
});

describe('calculateTopupAmount', () => {
    test('должен рассчитать доплату, если гарантия больше базовой доли', () => {
        expect(calculateTopupAmount(5000, 3000)).toBe(2000);
        expect(calculateTopupAmount(4000, 2000)).toBe(2000);
    });

    test('должен вернуть 0, если гарантия меньше базовой доли', () => {
        expect(calculateTopupAmount(3000, 5000)).toBe(0);
        expect(calculateTopupAmount(2000, 4000)).toBe(0);
    });

    test('должен вернуть 0, если гарантия равна базовой доле', () => {
        expect(calculateTopupAmount(3000, 3000)).toBe(0);
    });

    test('должен округлить результат до 2 знаков', () => {
        expect(calculateTopupAmount(5000.123, 3000.456)).toBe(1999.67);
    });

    test('должен обработать нулевые значения', () => {
        expect(calculateTopupAmount(0, 0)).toBe(0);
        expect(calculateTopupAmount(1000, 0)).toBe(1000);
        expect(calculateTopupAmount(0, 1000)).toBe(0);
    });
});

