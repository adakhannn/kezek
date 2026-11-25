import { closeStaffShiftUseCase } from '@/lib/staffShift/closeUseCase';

const shift = {
    id: 'shift-1',
    staff_id: 'staff-1',
    biz_id: 'biz-1',
    shift_date: '2026-11-25',
    status: 'open' as const,
    opened_at: '2026-11-25T03:00:00Z',
};
const staff = { percentMaster: 60, percentSalon: 40, hourlyRate: null };
const now = new Date('2026-11-25T11:00:00Z');

describe('closeStaffShiftUseCase totals', () => {
    test('an empty ledger closes with zero revenue (R25-01)', () => {
        const result = closeStaffShiftUseCase({ now, staff, shift, items: [] });
        if (result.kind !== 'ok') throw new Error('expected ok');
        expect(result.totalAmount).toBe(0);
        expect(result.totalConsumables).toBe(0);
        expect(result.financials.finalMasterShare).toBe(0);
    });

    test('sums are rounded to cents so they equal the numeric(12,2) ledger (R25-02)', () => {
        const result = closeStaffShiftUseCase({
            now,
            staff,
            shift,
            items: [
                { serviceAmount: 1048.05, consumablesAmount: 0.1 },
                { serviceAmount: 850.15, consumablesAmount: 0.2 },
            ],
        });
        if (result.kind !== 'ok') throw new Error('expected ok');
        expect(result.totalAmount).toBe(1898.2);
        expect(result.totalConsumables).toBe(0.3);
        expect(result.financials.totalAmount).toBe(1898.2);

        const triple = closeStaffShiftUseCase({ now, staff, shift, items: [450.15, 450.15, 450.15].map((serviceAmount) => ({ serviceAmount })) });
        if (triple.kind !== 'ok') throw new Error('expected ok');
        expect(triple.totalAmount).toBe(1350.45);
    });
});
