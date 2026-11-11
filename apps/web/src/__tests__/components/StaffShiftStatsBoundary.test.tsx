/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';

import { useShiftStats } from '@/app/staff/finance/hooks/useShiftStats';

const date = new Date('2026-10-18T06:00:00Z');
const options = { statsPeriod: 'all' as const, selectedDate: date, selectedMonth: date, selectedYear: 2026 };
const zero = { totalAmount: 0, totalMaster: 0, totalSalon: 0, totalLateMinutes: 0, shiftsCount: 0 };

test('empty closed-shift input has explicit zero totals', () => {
    const { result } = renderHook(() => useShiftStats({ ...options, allShifts: [] }));
    expect(result.current).toEqual(zero);
});

test('zero-valued historical fields do not become NaN or invent financial amounts', () => {
    const { result } = renderHook(() => useShiftStats({ ...options, allShifts: [{
        shift_date: '', status: 'closed', total_amount: 0, master_share: 0,
        salon_share: 0, late_minutes: 0,
    }] }));
    expect(result.current).toEqual({ ...zero, shiftsCount: 1 });
});

test('employee guarantee can exceed base share without a second deduction from saved business share', () => {
    const { result } = renderHook(() => useShiftStats({ ...options, allShifts: [{
        // Closed ledger master_share already includes the 240 guarantee top-up.
        shift_date: '2026-10-18', status: 'closed', total_amount: 600, master_share: 600,
        salon_share: 50, late_minutes: 0, guaranteed_amount: 600, topup_amount: 240,
    }] }));
    expect(result.current).toEqual({
        totalAmount: 600, totalMaster: 600, totalSalon: 50, totalLateMinutes: 0, shiftsCount: 1,
    });
});
