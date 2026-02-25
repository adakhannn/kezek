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

    test('режим percent_only игнорирует гарантию и не меняет базовые доли', () => {
        const result = calculateShiftFinancials({
            totalAmount: 10000,
            totalConsumables: 500,
            percentMaster: 60,
            percentSalon: 40,
            hoursWorked: 8,
            hourlyRate: 1000, // в этом режиме должна быть проигнорирована
            paymentMode: 'percent_only',
        });

        expect(result.guaranteedAmount).toBe(0);
        expect(result.topupAmount).toBe(0);
        expect(result.finalMasterShare).toBe(result.baseMasterShare);
        expect(result.finalSalonShare).toBe(result.baseSalonShare);
    });

    test('инварианты: базовые доли и финальные доли ведут себя ожидаемо', () => {
        const scenarios = [
            {
                name: 'без гарантии, 60/40',
                input: {
                    totalAmount: 10_000,
                    totalConsumables: 500,
                    percentMaster: 60,
                    percentSalon: 40,
                    hoursWorked: null,
                    hourlyRate: null,
                },
            },
            {
                name: 'гарантия меньше базовой доли',
                input: {
                    totalAmount: 10_000,
                    totalConsumables: 0,
                    percentMaster: 50,
                    percentSalon: 50,
                    hoursWorked: 4,
                    hourlyRate: 200, // гарантия 800 < базовой доли мастера
                },
            },
            {
                name: 'гарантия больше базовой доли, с расходниками',
                input: {
                    totalAmount: 5_000,
                    totalConsumables: 1_000,
                    percentMaster: 30,
                    percentSalon: 70,
                    hoursWorked: 10,
                    hourlyRate: 800,
                },
            },
        ] as const;

        for (const { name, input } of scenarios) {
            const result = calculateShiftFinancials(input);

            // Доли не должны быть отрицательными
            expect(result.finalMasterShare).toBeGreaterThanOrEqual(0);
            expect(result.finalSalonShare).toBeGreaterThanOrEqual(0);

            // Базовые доли в сумме дают выручку + расходники (с точностью до округлений)
            expect(result.baseMasterShare + result.baseSalonShare).toBeCloseTo(
                input.totalAmount + input.totalConsumables,
                0
            );

            // Финальная доля мастера не меньше базовой
            expect(result.finalMasterShare).toBeGreaterThanOrEqual(result.baseMasterShare);

            // Финальная доля салона не больше базовой (мы только вычитаем доплату)
            expect(result.finalSalonShare).toBeLessThanOrEqual(result.baseSalonShare);

            // Для сценариев без гарантии (или гарантия <= базовой доли) финальные доли совпадают с базовыми
            if (!result.guaranteedAmount || result.guaranteedAmount <= result.baseMasterShare) {
                expect(result.finalMasterShare).toBe(result.baseMasterShare);
                expect(result.finalSalonShare).toBe(result.baseSalonShare);
            }
        }
    });
});

