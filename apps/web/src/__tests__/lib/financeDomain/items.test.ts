/**
 * Unit-тесты для расчета сумм из items
 */

import {
    calculateTotalServiceAmount,
    calculateTotalConsumables,
    applyAdjustmentsToTotals,
} from '@/lib/financeDomain/items';

describe('calculateTotalServiceAmount', () => {
    test('должен рассчитать общую сумму услуг', () => {
        const items = [
            { serviceAmount: 1000 },
            { serviceAmount: 2000 },
            { serviceAmount: 500 },
        ];
        expect(calculateTotalServiceAmount(items)).toBe(3500);
    });

    test('должен игнорировать null и undefined значения', () => {
        const items = [
            { serviceAmount: 1000 },
            { serviceAmount: null },
            { serviceAmount: undefined },
            { serviceAmount: 500 },
        ];
        expect(calculateTotalServiceAmount(items)).toBe(1500);
    });

    test('должен игнорировать отрицательные значения', () => {
        const items = [
            { serviceAmount: 1000 },
            { serviceAmount: -500 },
            { serviceAmount: 500 },
        ];
        expect(calculateTotalServiceAmount(items)).toBe(1500);
    });

    test('должен обработать пустой массив', () => {
        expect(calculateTotalServiceAmount([])).toBe(0);
    });

    test('должен обработать NaN значения', () => {
        const items = [
            { serviceAmount: 1000 },
            { serviceAmount: NaN },
            { serviceAmount: 500 },
        ];
        expect(calculateTotalServiceAmount(items)).toBe(1500);
    });

    test('должен обработать дробные значения', () => {
        const items = [
            { serviceAmount: 1000.5 },
            { serviceAmount: 2000.25 },
        ];
        expect(calculateTotalServiceAmount(items)).toBe(3000.75);
    });
});

describe('calculateTotalConsumables', () => {
    test('должен рассчитать общую сумму расходников', () => {
        const items = [
            { consumablesAmount: 100 },
            { consumablesAmount: 200 },
            { consumablesAmount: 50 },
        ];
        expect(calculateTotalConsumables(items)).toBe(350);
    });

    test('должен игнорировать null и undefined значения', () => {
        const items = [
            { consumablesAmount: 100 },
            { consumablesAmount: null },
            { consumablesAmount: undefined },
            { consumablesAmount: 50 },
        ];
        expect(calculateTotalConsumables(items)).toBe(150);
    });

    test('должен игнорировать отрицательные значения', () => {
        const items = [
            { consumablesAmount: 100 },
            { consumablesAmount: -50 },
            { consumablesAmount: 50 },
        ];
        expect(calculateTotalConsumables(items)).toBe(150);
    });

    test('должен обработать пустой массив', () => {
        expect(calculateTotalConsumables([])).toBe(0);
    });

    test('должен обработать NaN значения', () => {
        const items = [
            { consumablesAmount: 100 },
            { consumablesAmount: NaN },
            { consumablesAmount: 50 },
        ];
        expect(calculateTotalConsumables(items)).toBe(150);
    });
});

describe('applyAdjustmentsToTotals', () => {
    test('полный возврат услуги и расходников обнуляет суммы смены', () => {
        const baseAmount = 3000;
        const baseConsumables = 300;

        const { totalAmount, totalConsumables } = applyAdjustmentsToTotals(baseAmount, baseConsumables, [
            { serviceDelta: -3000, consumablesDelta: -300 },
        ]);

        expect(totalAmount).toBe(0);
        expect(totalConsumables).toBe(0);
    });

    test('частичный возврат уменьшает суммы смены, но не уводит в минус', () => {
        const baseAmount = 3000;
        const baseConsumables = 300;

        const { totalAmount, totalConsumables } = applyAdjustmentsToTotals(baseAmount, baseConsumables, [
            { serviceDelta: -1000, consumablesDelta: -50 },
        ]);

        expect(totalAmount).toBe(2000);
        expect(totalConsumables).toBe(250);
    });

    test('возврат только услуги не трогает расходники', () => {
        const baseAmount = 3000;
        const baseConsumables = 300;

        const { totalAmount, totalConsumables } = applyAdjustmentsToTotals(baseAmount, baseConsumables, [
            { serviceDelta: -500 },
        ]);

        expect(totalAmount).toBe(2500);
        expect(totalConsumables).toBe(300);
    });

    test('возврат только расходников не трогает сумму услуг', () => {
        const baseAmount = 3000;
        const baseConsumables = 300;

        const { totalAmount, totalConsumables } = applyAdjustmentsToTotals(baseAmount, baseConsumables, [
            { consumablesDelta: -200 },
        ]);

        expect(totalAmount).toBe(3000);
        expect(totalConsumables).toBe(100);
    });

    test('несколько корректировок суммируются и нижняя граница 0', () => {
        const baseAmount = 1000;
        const baseConsumables = 100;

        const { totalAmount, totalConsumables } = applyAdjustmentsToTotals(baseAmount, baseConsumables, [
            { serviceDelta: -600, consumablesDelta: -50 },
            { serviceDelta: -600, consumablesDelta: -100 },
        ]);

        // 1000 - 600 - 600 = -200 -> 0
        expect(totalAmount).toBe(0);
        // 100 - 50 - 100 = -50 -> 0
        expect(totalConsumables).toBe(0);
    });
});

