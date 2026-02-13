/**
 * Unit-тесты для расчета долей для отображения
 */

import { calculateDisplayShares } from '@/lib/financeDomain/display';

describe('calculateDisplayShares', () => {
    test('должен использовать базовые доли для закрытой смены', () => {
        const result = calculateDisplayShares(6000, 4000, null, false);
        expect(result.masterShare).toBe(6000);
        expect(result.salonShare).toBe(4000);
    });

    test('должен использовать базовые доли для открытой смены без гарантии', () => {
        const result = calculateDisplayShares(6000, 4000, null, true);
        expect(result.masterShare).toBe(6000);
        expect(result.salonShare).toBe(4000);
    });

    test('должен учитывать гарантию для открытой смены, если она меньше базовой доли', () => {
        const result = calculateDisplayShares(6000, 4000, 4000, true);
        expect(result.masterShare).toBe(6000); // Максимум из гарантии и базовой доли
        expect(result.salonShare).toBe(4000);
    });

    test('должен учитывать гарантию для открытой смены, если она больше базовой доли', () => {
        const result = calculateDisplayShares(6000, 4000, 8000, true);
        expect(result.masterShare).toBe(8000); // Гарантия
        expect(result.salonShare).toBe(0); // 4000 - 2000 (topup) = 2000, но минимум 0
    });

    test('должен округлить результат до 2 знаков', () => {
        const result = calculateDisplayShares(6000.123, 4000.456, null, false);
        expect(result.masterShare).toBe(6000.12);
        expect(result.salonShare).toBe(4000.46);
    });

    test('должен обработать нулевые значения', () => {
        const result = calculateDisplayShares(0, 0, null, false);
        expect(result.masterShare).toBe(0);
        expect(result.salonShare).toBe(0);
    });

    test('должен обработать случай, когда гарантия равна базовой доле', () => {
        const result = calculateDisplayShares(6000, 4000, 6000, true);
        expect(result.masterShare).toBe(6000);
        expect(result.salonShare).toBe(4000);
    });
});

