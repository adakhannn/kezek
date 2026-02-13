/**
 * Unit-тесты для расчета базовых долей
 */

import {
    calculateBaseMasterShare,
    calculateBaseSalonShare,
    calculateBaseShares,
} from '@/lib/financeDomain/shares';

describe('calculateBaseMasterShare', () => {
    test('должен рассчитать базовую долю мастера', () => {
        expect(calculateBaseMasterShare(1000, 60, 40)).toBe(600);
        expect(calculateBaseMasterShare(1000, 50, 50)).toBe(500);
        expect(calculateBaseMasterShare(1000, 70, 30)).toBe(700);
    });

    test('должен округлить результат до целого', () => {
        expect(calculateBaseMasterShare(100, 33, 67)).toBe(33);
        expect(calculateBaseMasterShare(100, 66, 34)).toBe(66);
    });

    test('должен обработать нулевую сумму', () => {
        expect(calculateBaseMasterShare(0, 60, 40)).toBe(0);
    });

    test('должен нормализовать проценты, если они не в сумме 100', () => {
        // 30 + 20 = 50, нормализуется до 60/40
        expect(calculateBaseMasterShare(1000, 30, 20)).toBe(600);
    });
});

describe('calculateBaseSalonShare', () => {
    test('должен рассчитать базовую долю салона с учетом расходников', () => {
        // 1000 * 0.4 + 100 = 500
        expect(calculateBaseSalonShare(1000, 100, 60, 40)).toBe(500);
    });

    test('должен включить расходники в долю салона', () => {
        expect(calculateBaseSalonShare(1000, 0, 60, 40)).toBe(400);
        expect(calculateBaseSalonShare(1000, 200, 60, 40)).toBe(600);
    });

    test('должен обработать нулевую сумму услуг', () => {
        expect(calculateBaseSalonShare(0, 100, 60, 40)).toBe(100);
    });

    test('должен обработать нулевые расходники', () => {
        expect(calculateBaseSalonShare(1000, 0, 60, 40)).toBe(400);
    });
});

describe('calculateBaseShares', () => {
    test('должен рассчитать обе доли одновременно', () => {
        const result = calculateBaseShares(1000, 100, 60, 40);
        expect(result.masterShare).toBe(600);
        expect(result.salonShare).toBe(500); // 400 + 100
    });

    test('должен обработать нулевые значения', () => {
        const result = calculateBaseShares(0, 0, 60, 40);
        expect(result.masterShare).toBe(0);
        expect(result.salonShare).toBe(0);
    });

    test('должен обработать большие суммы', () => {
        const result = calculateBaseShares(100000, 5000, 60, 40);
        expect(result.masterShare).toBe(60000);
        expect(result.salonShare).toBe(45000); // 40000 + 5000
    });
});

