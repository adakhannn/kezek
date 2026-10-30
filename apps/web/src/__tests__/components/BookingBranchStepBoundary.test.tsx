/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useBookingSteps } from '@/app/b/[slug]/hooks/useBookingSteps';

const base = {
    branchId: 'active-branch', dayStr: '2026-10-20', staffId: 'staff', staffAvailable: true,
    serviceIds: ['service'], servicesFiltered: [{id:'service',branch_id:'active-branch',name_ru:'Test',duration_min:60}],
    t: (key: string, fallback?: string) => fallback ?? key,
};

it.each([2, 3, 4, 5])('rejects stale branch URL requested step %s before rendering a later step', initialStep => {
    const params = {...base, branchId:'', initialStep, initialBranchValid:false};
    const {result} = renderHook(() => useBookingSteps(params));
    expect(result.current.step).toBe(1);
    expect(result.current.canGoNext).toBe(false);
    act(() => result.current.goNext());
    expect(result.current.step).toBe(1);
});

it.each([2, 3, 4, 5])('retains valid active-branch return URL step %s', initialStep => {
    const params = {...base, initialStep, initialBranchValid:true};
    const {result} = renderHook(() => useBookingSteps(params));
    expect(result.current.step).toBe(initialStep);
});

it.each([2, 3, 4])('does not advance from restored step %s without its branch prerequisite', initialStep => {
    const params = {...base, branchId:'', initialStep};
    const {result} = renderHook(() => useBookingSteps(params));
    expect(result.current.canGoNext).toBe(false);
    act(() => result.current.goNext());
    expect(result.current.step).toBe(initialStep);
});

it('waits for a valid URL branch to hydrate without losing the requested step', () => {
    const {result, rerender} = renderHook(({branchId}) => useBookingSteps({...base, branchId, initialStep:2}), {
        initialProps:{branchId:''},
    });
    expect(result.current.step).toBe(2);
    expect(result.current.canGoNext).toBe(false);
    rerender({branchId:'active-branch'});
    expect(result.current.canGoNext).toBe(true);
    act(() => result.current.goNext());
    expect(result.current.step).toBe(3);
});

it('lets a visitor recover from a stale branch by choosing the active control and going back', () => {
    const onStepChange = jest.fn();
    const {result, rerender} = renderHook(({branchId}) => useBookingSteps({
        ...base, branchId, initialStep:2, initialBranchValid:false, onStepChange,
    }), {initialProps:{branchId:''}});
    expect(result.current.step).toBe(1);
    act(() => result.current.goPrev());
    expect(onStepChange).not.toHaveBeenCalled();
    rerender({branchId:'active-branch'});
    act(() => result.current.goNext());
    expect(result.current.step).toBe(2);
    act(() => result.current.goPrev());
    expect(result.current.step).toBe(1);
    expect(result.current.canGoNext).toBe(true);
    expect(onStepChange).toHaveBeenLastCalledWith(1);
});
