import { getShiftCompensation, getShiftTotals } from '../../screens/shiftQuick/calculations';

describe('shiftQuick calculations', () => {
    it('calculates totals from shift items', () => {
        const result = getShiftTotals([
            { clientName: 'A', serviceName: 'Cut', serviceAmount: 1000, consumablesAmount: 100, bookingId: null },
            { clientName: 'B', serviceName: 'Color', serviceAmount: 2000, consumablesAmount: 250, bookingId: null },
        ]);

        expect(result).toEqual({
            totalAmount: 3000,
            totalConsumables: 350,
        });
    });

    it('respects guaranteed amount when it is above base share', () => {
        const result = getShiftCompensation(
            [
                { clientName: 'A', serviceName: 'Cut', serviceAmount: 1000, consumablesAmount: 100, bookingId: null },
            ],
            {
                today: { exists: true, status: 'open', shift: null, items: [] },
                staffPercentMaster: 60,
                staffPercentSalon: 40,
                hourlyRate: null,
                currentHoursWorked: null,
                currentGuaranteedAmount: 900,
                isDayOff: false,
            }
        );

        expect(result.baseMasterShare).toBe(600);
        expect(result.currentGuaranteed).toBe(900);
        expect(result.finalMasterShare).toBe(900);
        expect(result.topupAmount).toBe(300);
        expect(result.finalSalonShare).toBe(200);
    });
});
