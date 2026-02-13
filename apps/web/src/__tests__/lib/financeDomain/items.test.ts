/**
 * Unit-тесты для расчета сумм из items
 */

import {
    calculateTotalServiceAmount,
    calculateTotalConsumables,
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

