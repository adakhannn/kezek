/** @jest-environment jsdom */
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderHook } from '@testing-library/react';

import { useShiftStats } from '@/app/staff/finance/hooks/useShiftStats';
import { getShiftData } from '@/app/staff/finance/services/shiftDataService';

jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logError: jest.fn() }));
jest.mock('@/lib/scheduling/config', () => ({ explicitSchedulingEnabled: () => false }));

const closed = {
    shift_date: '2026-10-13', status: 'closed', total_amount: 600,
    master_share: 600, salon_share: 50, late_minutes: 516,
    guaranteed_amount: 600, topup_amount: 240,
};
const date = new Date('2026-10-13T06:00:00Z');

test.each(['day', 'month', 'year', 'all'] as const)(
    '%s sums the final saved business share without deducting its top-up twice', statsPeriod => {
        const { result } = renderHook(() => useShiftStats({
            allShifts: [closed, { ...closed, status: 'open', salon_share: 999 }],
            statsPeriod, selectedDate: date, selectedMonth: date, selectedYear: 2026,
        }));
        expect(result.current).toEqual({
            totalAmount: 600, totalMaster: 600, totalSalon: 50,
            totalLateMinutes: 516, shiftsCount: 1,
        });
    },
);

test.each([
    [169, 0],
    [-5, 10],
] as const)('retains the saved salon share %s with top-up metadata %s', (salon_share, topup_amount) => {
    const { result } = renderHook(() => useShiftStats({
        allShifts: [{ ...closed, salon_share, topup_amount }], statsPeriod: 'all',
        selectedDate: date, selectedMonth: date, selectedYear: 2026,
    }));
    expect(result.current.totalSalon).toBe(salon_share);
});

test('a different day has no closed-shift totals', () => {
    const { result } = renderHook(() => useShiftStats({
        allShifts: [closed], statsPeriod: 'day', selectedDate: new Date('2026-10-17T06:00:00Z'),
        selectedMonth: date, selectedYear: 2026,
    }));
    expect(result.current).toEqual({ totalAmount: 0, totalMaster: 0, totalSalon: 0, totalLateMinutes: 0, shiftsCount: 0 });
});

test('SSR finance payload and browser aggregation use the same final closed shares', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-17T01:00:00Z'));
    try {
        const supabase = {
            rpc: jest.fn(async (name: string) => ({ data: name === 'read_staff_finance_calendar' ? { date: '2026-10-17', todayDate: '2026-10-17', timezone: 'Asia/Bishkek', dayStart: '2026-10-16T18:00Z', dayEnd: '2026-10-17T18:00Z', dayHours: 24 } : name === 'read_staff_shift_snapshot' ? null : [closed], error: null })),
            from: jest.fn((table: string) => {
                let single = false;
                const builder: Record<string, unknown> = {};
                for (const key of ['select', 'eq', 'gte', 'lt', 'lte', 'neq', 'order', 'is']) {
                    builder[key] = jest.fn(() => builder);
                }
                builder.maybeSingle = jest.fn(() => { single = true; return builder; });
                builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({
                    data: table === 'staff' ? { percent_master: 60, percent_salon: 40, hourly_rate: null }
                        : table === 'staff_shifts' ? (single ? null : [closed]) : (single ? null : []),
                    error: null,
                }).then(resolve);
                return builder;
            }),
        };
        const result = await getShiftData({
            supabase: supabase as unknown as SupabaseClient, staffId: 'staff', bizId: 'biz', targetDate: new Date(),
        });
        expect(result.stats).toEqual({ totalAmount: 600, totalMaster: 600, totalSalon: 50, totalLateMinutes: 516, shiftsCount: 1 });
        expect(result.allShifts[0]).toMatchObject({ salon_share: 50, topup_amount: 240 });
    } finally { jest.useRealTimers(); }
});

test('saved master payout is authoritative even when historical guarantee metadata differs', () => {
    const { result } = renderHook(() => useShiftStats({ allShifts: [{ ...closed, master_share: 700, guaranteed_amount: 900 }], statsPeriod: 'all', selectedDate: date, selectedMonth: date, selectedYear: 2026 }));
    expect(result.current.totalMaster).toBe(700);
});
