/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useFinancePageViewState } from '@/app/staff/finance/hooks/useFinancePageViewState';

const scope = 'business-a:staff-a';
const historical = new Date('2026-10-13T06:00:00Z');
beforeEach(() => sessionStorage.clear());

test('remount keeps the statistics tab, day and date without persisting the shift operation date', () => {
    const first = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    act(() => {
        first.result.current.handleTabChange('stats');
        first.result.current.setStatsPeriod('day');
        first.result.current.setSelectedDate(historical);
        first.result.current.setShiftDate(historical);
        first.result.current.setShowShiftDetails(true);
    });
    first.unmount();
    const second = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    expect(second.result.current.activeTab).toBe('stats');
    expect(second.result.current.statsPeriod).toBe('day');
    expect(second.result.current.selectedDate).toEqual(historical);
    expect(second.result.current.shiftDate).not.toEqual(historical);
    expect(second.result.current.showShiftDetails).toBe(false);
});

test('month and year selections survive a remount', () => {
    const first = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    act(() => {
        first.result.current.handleTabChange('stats');
        first.result.current.setStatsPeriod('month');
        first.result.current.setSelectedMonth(historical);
        first.result.current.setSelectedYear(2025);
    });
    first.unmount();
    const second = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    expect(second.result.current.statsPeriod).toBe('month');
    expect(second.result.current.selectedMonth).toEqual(historical);
    expect(second.result.current.selectedYear).toBe(2025);
});

test('another server-provided staff/business scope cannot inherit the previous view', () => {
    const first = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    act(() => first.result.current.handleTabChange('stats'));
    first.unmount();
    const second = renderHook(() => useFinancePageViewState({ viewScope: 'business-b:staff-b' }));
    expect(second.result.current.activeTab).toBe('shift');
    second.unmount();
    const original = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    expect(original.result.current.activeTab).toBe('stats');
});

test('corrupt stored view is ignored', () => {
    sessionStorage.setItem(`finance-view-v1-${scope}`, '{invalid');
    const { result } = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    expect(result.current.activeTab).toBe('shift');
    expect(result.current.statsPeriod).toBe('all');
});

test('persisted view contains only tab and read-only statistical filters', () => {
    const { result } = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    act(() => result.current.handleTabChange('stats'));
    const saved = JSON.parse(sessionStorage.getItem(`finance-view-v1-${scope}`) ?? '{}');
    expect(Object.keys(saved).sort()).toEqual(['activeTab', 'selectedDate', 'selectedMonth', 'selectedYear', 'statsPeriod']);
    expect(saved).not.toHaveProperty('shiftDate');
    expect(saved).not.toHaveProperty('items');
});

test('legacy owner tab storage remains separate from scoped staff view', () => {
    sessionStorage.setItem('finance-active-tab-owner-staff', 'stats');
    const owner = renderHook(() => useFinancePageViewState({ staffId: 'owner-staff' }));
    expect(owner.result.current.activeTab).toBe('stats');
    owner.unmount();
    const own = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    expect(own.result.current.activeTab).toBe('shift');
});

test('malformed values cannot restore an invalid tab, period, year or calendar date', () => {
    sessionStorage.setItem(`finance-view-v1-${scope}`, JSON.stringify({
        activeTab: 'delete', statsPeriod: 'forever', selectedDate: '2026-02-30T06:00:00.000Z',
        selectedMonth: 'not-a-date', selectedYear: -1, items: [{ amount: 999 }],
    }));
    const { result } = renderHook(() => useFinancePageViewState({ viewScope: scope }));
    expect(result.current.activeTab).toBe('shift');
    expect(result.current.statsPeriod).toBe('all');
    expect(result.current.selectedDate.getMonth()).not.toBe(1);
    expect(result.current.selectedYear).toBe(new Date().getFullYear());
});

test('a scope prop change immediately selects that scope rather than the preceding staff view', () => {
    const { result, rerender } = renderHook(({ viewScope }) => useFinancePageViewState({ viewScope }), { initialProps: { viewScope: scope } });
    act(() => result.current.handleTabChange('stats'));
    rerender({ viewScope: 'business-c:staff-c' });
    expect(result.current.activeTab).toBe('shift');
    rerender({ viewScope: scope });
    expect(result.current.activeTab).toBe('stats');
});

test('storage write failure does not disable tab interaction or serialize operation state', () => {
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    try {
        const { result } = renderHook(() => useFinancePageViewState({ viewScope: 'storage-failure:staff' }));
        act(() => result.current.handleTabChange('stats'));
        expect(result.current.activeTab).toBe('stats');
        act(() => result.current.setStatsPeriod('day'));
        expect(result.current.statsPeriod).toBe('day');
    } finally { write.mockRestore(); }
});
