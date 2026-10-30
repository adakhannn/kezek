/** @jest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDashboardBookingsListController } from '@/app/dashboard/bookings/components/useDashboardBookingsListController';

const mockRows = [
    {id:'4e30608a-c3e2-449c-bc1b-75a1ec100404', status:'cancelled', start_at:'2026-10-12T03:00:00Z', end_at:'2026-10-12T04:00:00Z',
        branch_id:'branch', staff_id:'staff', services:{name_ru:'Стрижка',name_ky:'Чач кыркуу',name_en:'Haircut'}, staff:{full_name:'Адахан'}, client_name:'LIVE TEST Alice'},
    {id:'other-booking', status:'cancelled', start_at:'2026-10-12T04:00:00Z', end_at:'2026-10-12T05:00:00Z',
        branch_id:'branch', staff_id:'staff', services:[{name_ru:'Укладка',name_ky:'Жасалгалоо',name_en:'Styling'}], staff:[{full_name:'Other staff'}], client_phone:'+996555123456'},
];
const mockQuery: Record<string, jest.Mock> = {};
for (const method of ['select','eq','neq','in','gte','lte','order']) mockQuery[method] = jest.fn(() => mockQuery);
mockQuery.range = jest.fn(async () => ({data: mockRows, count: mockRows.length}));
jest.mock('@/lib/supabaseClient', () => ({supabase: {
    auth:{getUser:jest.fn(async () => ({data:{user:null}}))}, from:jest.fn(() => mockQuery),
}}));
jest.mock('@/lib/bookingDashboardService', () => ({cancelBookingWithFallback:jest.fn(),confirmBooking:jest.fn()}));

test('query changes immediately filter loaded history and clearing restores it without refresh', async () => {
    const {result} = renderHook(() => useDashboardBookingsListController({
        bizId:'biz',initial:[],timezone:'Asia/Bishkek',locale:'ru',t:(_key,fallback)=>fallback ?? _key,
        notify:jest.fn(),showError:jest.fn(),showSuccess:jest.fn(),
    }));
    await waitFor(() => expect(result.current.list).toHaveLength(2));
    act(() => result.current.setSearchQuery('4E30608A'));
    expect(result.current.list.map(row=>row.id)).toEqual([mockRows[0].id]);
    act(() => result.current.setSearchQuery('4e30608a-c3e2-449c-bc1b-75a1ec100404'));
    expect(result.current.list.map(row=>row.id)).toEqual([mockRows[0].id]);
    act(() => result.current.setSearchQuery('LIVE TEST NO MATCH 12 OCT'));
    expect(result.current.list).toHaveLength(0);
    act(() => result.current.setSearchQuery(''));
    expect(result.current.list).toHaveLength(2);
});

test('search uses displayed contacts, staff, multilingual services and restores data after refresh', async () => {
    const {result} = renderHook(() => useDashboardBookingsListController({
        bizId:'biz',initial:[],timezone:'Asia/Bishkek',locale:'en',t:(_key,fallback)=>fallback ?? _key,
        notify:jest.fn(),showError:jest.fn(),showSuccess:jest.fn(),
    }));
    await waitFor(() => expect(result.current.list).toHaveLength(2));
    for (const query of [' Alice ', 'Адахан', 'Haircut', 'Чач кыркуу', 'Стрижка']) {
        act(() => result.current.setSearchQuery(query));
        expect(result.current.list.map(row=>row.id)).toEqual([mockRows[0].id]);
    }
    act(() => result.current.setSearchQuery('555123456'));
    expect(result.current.list.map(row=>row.id)).toEqual([mockRows[1].id]);
    await act(async () => { await result.current.refresh(); });
    act(() => result.current.setSearchQuery(''));
    expect(result.current.list).toHaveLength(2);
});
