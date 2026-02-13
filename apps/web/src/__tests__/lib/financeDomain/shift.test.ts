/**
 * Unit-тесты для calculateShiftFinancials
 */

import { calculateShiftFinancials } from '@/lib/financeDomain/shift';

describe('calculateShiftFinancials', () => {
    test('должен рассчитать все финансовые показатели без гарантии', () => {
        const result = calculateShiftFinancials({
            totalAmount: 10000,
            totalConsumables: 500,
            percentMaster: 60,
            percentSalon: 40,
            hoursWorked: null,
            hourlyRate: null,
        });

        expect(result.totalAmount).toBe(10000);
        expect(result.totalConsumables).toBe(500);
        expect(result.baseMasterShare).toBe(6000);
        expect(result.baseSalonShare).toBe(4500); // 4000 + 500
        expect(result.guaranteedAmount).toBe(0);
        expect(result.topupAmount).toBe(0);
        expect(result.finalMasterShare).toBe(6000);
        expect(result.finalSalonShare).toBe(4500);
        expect(result.normalizedPercentMaster).toBe(60);
        expect(result.normalizedPercentSalon).toBe(40);
    });

    test('должен рассчитать с гарантией, которая меньше базовой доли', () => {
        const result = calculateShiftFinancials({
            totalAmount: 10000,
            totalConsumables: 500,
            percentMaster: 60,
            percentSalon: 40,
            hoursWorked: 8,
            hourlyRate: 500, // 4000 гарантия < 6000 базовая доля
        });

        expect(result.guaranteedAmount).toBe(4000);
        expect(result.topupAmount).toBe(0);
        expect(result.finalMasterShare).toBe(6000); // Максимум из гарантии и базовой доли
        expect(result.finalSalonShare).toBe(4500);
    });

    test('должен рассчитать с гарантией, которая больше базовой доли', () => {
        const result = calculateShiftFinancials({
            totalAmount: 10000,
            totalConsumables: 500,
            percentMaster: 60,
            percentSalon: 40,
            hoursWorked: 8,
            hourlyRate: 1000, // 8000 гарантия > 6000 базовая доля
        });

        expect(result.guaranteedAmount).toBe(8000);
        expect(result.topupAmount).toBe(2000); // 8000 - 6000
        expect(result.finalMasterShare).toBe(8000); // Гарантия
        expect(result.finalSalonShare).toBe(2500); // 4500 - 2000
    });

    test('должен нормализовать проценты, если они не в сумме 100', () => {
        const result = calculateShiftFinancials({
            totalAmount: 10000,
            totalConsumables: 500,
            percentMaster: 30,
            percentSalon: 20, // 30 + 20 = 50, нормализуется до 60/40
            hoursWorked: null,
            hourlyRate: null,
        });

        expect(result.normalizedPercentMaster).toBe(60);
        expect(result.normalizedPercentSalon).toBe(40);
        expect(result.baseMasterShare).toBe(6000);
    });

    test('должен обработать нулевые значения', () => {
        const result = calculateShiftFinancials({
            totalAmount: 0,
            totalConsumables: 0,
            percentMaster: 60,
            percentSalon: 40,
            hoursWorked: null,
            hourlyRate: null,
        });

        expect(result.totalAmount).toBe(0);
        expect(result.totalConsumables).toBe(0);
        expect(result.baseMasterShare).toBe(0);
        expect(result.baseSalonShare).toBe(0);
        expect(result.finalMasterShare).toBe(0);
        expect(result.finalSalonShare).toBe(0);
    });

    test('должен обработать отрицательные проценты (использует дефолтные 60/40)', () => {
        const result = calculateShiftFinancials({
            totalAmount: 10000,
            totalConsumables: 500,
            percentMaster: -10,
            percentSalon: -20,
            hoursWorked: null,
            hourlyRate: null,
        });

        expect(result.normalizedPercentMaster).toBe(60);
        expect(result.normalizedPercentSalon).toBe(40);
    });

    test('должен округлить финальные доли до 2 знаков', () => {
        const result = calculateShiftFinancials({
            totalAmount: 10000,
            totalConsumables: 500,
            percentMaster: 60,
            percentSalon: 40,
            hoursWorked: 8.333,
            hourlyRate: 500.123,
        });

        expect(result.finalMasterShare).toBeCloseTo(result.finalMasterShare, 2);
        expect(result.finalSalonShare).toBeCloseTo(result.finalSalonShare, 2);
    });

    test('должен обработать случай, когда доплата больше доли салона', () => {
        const result = calculateShiftFinancials({
            totalAmount: 1000,
            totalConsumables: 0,
            percentMaster: 60,
            percentSalon: 40,
            hoursWorked: 8,
            hourlyRate: 1000, // 8000 гарантия, базовая доля мастера 600
        });

        expect(result.guaranteedAmount).toBe(8000);
        expect(result.topupAmount).toBe(7400); // 8000 - 600
        expect(result.finalMasterShare).toBe(8000);
        expect(result.finalSalonShare).toBe(0); // 400 - 7400 = -7000, но минимум 0
    });
});

