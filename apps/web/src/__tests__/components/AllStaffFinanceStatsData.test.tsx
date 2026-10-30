/** @jest-environment jsdom */
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAllStaffFinanceStatsData } from '@/app/dashboard/finance/components/useAllStaffFinanceStatsData';

jest.mock('@/lib/log', () => ({ logError: jest.fn() }));
const translate = (_key: string, fallback?: string) => fallback ?? _key;
const totals = { totalAmount: 301, totalMaster: 181, totalSalon: 169, totalConsumables: 49,
    totalLateMinutes: 0, totalShifts: 1, totalOpenShifts: 0, totalClosedShifts: 1 };
const staff = { staffId: 'staff-1', staffName: 'LIVE TEST', isActive: true, shiftsCount: 1,
    openShiftsCount: 0, closedShiftsCount: 1, totalAmount: 301, totalMaster: 181,
    totalSalon: 169, totalConsumables: 49, totalLateMinutes: 0 };

describe('owner finance standard API response', () => {
    beforeEach(() => jest.clearAllMocks());
    test('reads nested totals, staff and branch options; preserves filter scope', async () => {
        const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({
            ok: true, data: { totalStats: totals, staffStats: [staff], branches: [{ id: 'branch-1', name: 'Branch' }] },
        }) } as Response);
        const { result } = renderHook(() => useAllStaffFinanceStatsData({ t: translate }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.totalStats).toEqual(totals);
        expect(result.current.staffStats).toEqual([staff]);
        expect(result.current.branches).toEqual([{ id: 'branch-1', name: 'Branch' }]);
        act(() => result.current.setBranchId('branch-1'));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
            expect.stringContaining('branchId=branch-1'), { cache: 'no-store' },
        ));
    });
    test.each([
        { httpOk: false, body: { ok: false, message: 'Denied' } },
        { httpOk: true, body: { ok: true } },
    ])('invalid response is an error, not a misleading empty ledger', async ({ httpOk, body }) => {
        jest.spyOn(global, 'fetch').mockResolvedValue({ ok: httpOk, json: async () => body } as Response);
        const { result } = renderHook(() => useAllStaffFinanceStatsData({ t: translate }));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeTruthy();
        expect(result.current.totalStats).toBeNull();
    });

    test('serializes day/month/year to the API precision without losing the day anchor', async () => {
        const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ok: true, json: async () => ({
            ok: true, data: {totalStats: totals, staffStats: [staff], branches: []},
        })} as Response);
        const {result} = renderHook(() => useAllStaffFinanceStatsData({t: translate}));
        await waitFor(() => expect(result.current.loading).toBe(false));
        act(() => result.current.setDate('2026-10-09'));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/dashboard/finance/all?period=day&date=2026-10-09', {cache: 'no-store'},
        ));
        act(() => result.current.setPeriod('month'));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/dashboard/finance/all?period=month&date=2026-10', {cache: 'no-store'},
        ));
        act(() => result.current.setPeriod('year'));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/dashboard/finance/all?period=year&date=2026', {cache: 'no-store'},
        ));
        act(() => result.current.setPeriod('day'));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/dashboard/finance/all?period=day&date=2026-10-09', {cache: 'no-store'},
        ));
        expect(result.current.date).toBe('2026-10-09');
    });
});
