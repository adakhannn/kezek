import { calculateDisplayShares } from '@/lib/financeDomain/display';

describe('calculateDisplayShares', () => {
    test('uses base shares for a closed shift', () => {
        const result = calculateDisplayShares(6000, 4000, null, false);
        expect(result.masterShare).toBe(6000);
        expect(result.salonShare).toBe(4000);
    });

    test('uses base shares for an open shift without guarantee', () => {
        const result = calculateDisplayShares(6000, 4000, null, true);
        expect(result.masterShare).toBe(6000);
        expect(result.salonShare).toBe(4000);
    });

    test('keeps base shares when guarantee is below base master share', () => {
        const result = calculateDisplayShares(6000, 4000, 4000, true);
        expect(result.masterShare).toBe(6000);
        expect(result.salonShare).toBe(4000);
    });

    test('applies topup when guarantee is above base master share', () => {
        const result = calculateDisplayShares(6000, 4000, 8000, true);
        expect(result.masterShare).toBe(8000);
        expect(result.salonShare).toBe(2000);
    });

    test('rounds result to two decimal places', () => {
        const result = calculateDisplayShares(6000.123, 4000.456, null, false);
        expect(result.masterShare).toBe(6000.12);
        expect(result.salonShare).toBe(4000.46);
    });

    test('handles zero values', () => {
        const result = calculateDisplayShares(0, 0, null, false);
        expect(result.masterShare).toBe(0);
        expect(result.salonShare).toBe(0);
    });

    test('keeps shares unchanged when guarantee equals base master share', () => {
        const result = calculateDisplayShares(6000, 4000, 6000, true);
        expect(result.masterShare).toBe(6000);
        expect(result.salonShare).toBe(4000);
    });
});
