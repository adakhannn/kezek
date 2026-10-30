/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { ru } from 'date-fns/locale/ru';

import { useBookingFlowDerived } from '@/app/b/[slug]/hooks/useBookingFlowDerived';
import { useBookingSteps } from '@/app/b/[slug]/hooks/useBookingSteps';

const staff = [{ id:'staff-1', branch_id:'branch-1', full_name:'Test', rating_score:null }];
const homeDay = [{ staff_id:'staff-1', branch_id:'branch-1', date:'2026-10-19' }];
function derived(workingLocations: typeof homeDay | undefined, staffAvailabilityReady = true) {
    const params = {
        selectionReady:true, branchId:'branch-1', businessTz:'Asia/Bishkek',
        day:new Date('2026-10-19T00:00:00+06:00'), dayStr:'2026-10-19', dateLocale:ru,
        serviceId:'', serviceIds:[], services:[], servicesByBranch:[], servicesFiltered:[],
        setServiceIds:jest.fn(), staff, staffByBranch:staff, staffId:'', temporaryTransfers:[],
        workingLocations, staffAvailabilityReady,
    };
    return renderHook(() => useBookingFlowDerived(params)).result.current.staffFiltered;
}

test('a complete empty effective-day projection excludes home-branch staff on an off day', () => {
    expect(derived([])).toEqual([]);
});
test('a published home working day keeps its specialist', () => {
    expect(derived(homeDay)).toEqual(staff);
});
test('an effective transfer does not leave the master in the home branch', () => {
    expect(derived([{...homeDay[0], branch_id:'branch-2'}])).toEqual([]);
});
test('another date cannot stand in for the selected effective day', () => {
    expect(derived([{...homeDay[0], date:'2026-10-20'}])).toEqual([]);
});
test('loading or failed availability does not advertise every home specialist', () => {
    expect(derived(undefined, false)).toEqual([]);
});
test('explicitly incomplete legacy transfer data retains its previous semantics', () => {
    expect(derived(undefined)).toEqual(staff);
});
test.each(['staff-1','any'])('restored %s selection cannot advance after availability disappears', staffId => {
    const params = {branchId:'branch-1', dayStr:'2026-10-19', staffId, serviceIds:[], servicesFiltered:[],
        staffAvailable:false, t:(_key:string, fallback?:string) => fallback ?? '', initialStep:3};
    const { result } = renderHook(() => useBookingSteps(params));
    expect(result.current.canGoNext).toBe(false);
});
