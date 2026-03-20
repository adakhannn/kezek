import { calculateShiftFinancials } from '../shift';

describe('finance/shift', () => {
    it('calculates financials without guarantee', () => {
        const result = calculateShiftFinancials({
            totalAmount: 10000,
            totalConsumables: 500,
            percentMaster: 60,
            percentSalon: 40,
            hoursWorked: null,
            hourlyRate: null,
        });

        expect(result.baseMasterShare).toBe(6000);
        expect(result.baseSalonShare).toBe(4500);
        expect(result.guaranteedAmount).toBe(0);
        expect(result.finalMasterShare).toBe(6000);
        expect(result.finalSalonShare).toBe(4500);
    });

    it('applies topup when guarantee is higher than base master share', () => {
        const result = calculateShiftFinancials({
            totalAmount: 10000,
            totalConsumables: 500,
            percentMaster: 60,
            percentSalon: 40,
            hoursWorked: 8,
            hourlyRate: 1000,
        });

        expect(result.guaranteedAmount).toBe(8000);
        expect(result.topupAmount).toBe(2000);
        expect(result.finalMasterShare).toBe(8000);
        expect(result.finalSalonShare).toBe(2500);
    });
});
