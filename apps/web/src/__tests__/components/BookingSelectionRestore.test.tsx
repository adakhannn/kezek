/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { ru } from 'date-fns/locale/ru';
import type { ReadonlyURLSearchParams } from 'next/navigation';

import { useBookingSelectionState } from '@/app/b/[slug]/hooks/useBookingSelectionState';
import { useBookingFlowDerived } from '@/app/b/[slug]/hooks/useBookingFlowDerived';
import type { Service, Staff, Branch } from '@/app/b/[slug]/types';

const services: Service[] = [{id:'service-1', name_ru:'Test', branch_id:'branch-1', duration_min:60}];
const staff: Staff[] = [{id:'staff-1', full_name:'Test', branch_id:'branch-1', rating_score:null}];
const branches: Branch[] = [{id:'branch-1', name:'Test', rating_score:null}];
const searchParams = new URLSearchParams('branch=branch-1&day=2026-10-12&staff=staff-1&service=service-1') as ReadonlyURLSearchParams;

function useRestoredBooking(catalogLoaded: boolean, filtered: Service[]) {
    const selection = useBookingSelectionState({bizId:'biz-1', bizTz:'Asia/Bishkek', branches, services, staff, searchParams});
    const derived = useBookingFlowDerived({
        ...selection, services, staff, dateLocale:ru, servicesFiltered:filtered, temporaryTransfers:[],
        selectionReady:selection.restoredFromStorage && catalogLoaded,
    });
    return {...selection, ...derived};
}

beforeEach(() => window.localStorage.clear());

test('retains URL service while catalog is loading, then validates it', () => {
    const {result, rerender} = renderHook(({loaded, filtered}) => useRestoredBooking(loaded, filtered), {
        initialProps:{loaded:false, filtered:[] as Service[]},
    });
    expect(result.current.serviceIds).toEqual(['service-1']);
    expect(result.current.dayStr).toBe('2026-10-12');
    rerender({loaded:true, filtered:services});
    expect(result.current.serviceIds).toEqual(['service-1']);
    expect(result.current.totalDurationStep4).toBe(60);
});

test('restores saved OAuth selection without premature catalog cleanup', () => {
    window.localStorage.setItem('booking_state_biz-1', JSON.stringify({branchId:'branch-1', day:'2026-10-12', staffId:'staff-1', serviceIds:['service-1']}));
    const {result, rerender} = renderHook(({loaded, filtered}) => useRestoredBooking(loaded, filtered), {
        initialProps:{loaded:false, filtered:[] as Service[]},
    });
    expect(result.current.serviceIds).toEqual(['service-1']);
    expect(window.localStorage.getItem('booking_state_biz-1')).toBeNull();
    rerender({loaded:true, filtered:services});
    expect(result.current.servicesForBooking).toEqual(services);
});

test('still rejects an invalid restored service once authoritative data loads', () => {
    const {result, rerender} = renderHook(({loaded, filtered}) => useRestoredBooking(loaded, filtered), {
        initialProps:{loaded:false, filtered:[] as Service[]},
    });
    expect(result.current.serviceIds).toEqual(['service-1']);
    rerender({loaded:true, filtered:[]});
    expect(result.current.serviceIds).toEqual([]);
    act(() => result.current.setStaffId(''));
    expect(result.current.serviceIds).toEqual([]);
});

test('clears the old staff and services when the user chooses another branch after restoration', () => {
    const { result } = renderHook(() => useRestoredBooking(true, services));
    expect(result.current.staffId).toBe('staff-1');
    expect(result.current.serviceIds).toEqual(['service-1']);
    act(() => result.current.setBranchId('branch-2'));
    expect(result.current.branchId).toBe('branch-2');
    expect(result.current.staffId).toBe('');
    expect(result.current.serviceIds).toEqual([]);
    expect(result.current.dayStr).toBe('2026-10-12');
});

test('does not erase a restored choice when selecting the same branch', () => {
    const { result } = renderHook(() => useRestoredBooking(true, services));
    act(() => result.current.setBranchId('branch-1'));
    expect(result.current.staffId).toBe('staff-1');
    expect(result.current.serviceIds).toEqual(['service-1']);
});
