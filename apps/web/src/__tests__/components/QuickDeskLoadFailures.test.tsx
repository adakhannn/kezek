/** @jest-environment jsdom */
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

import { bookingsRu } from '@/app/_components/i18n/dictionaries/bookings.ru';
import { QuickDesk } from '@/app/dashboard/bookings/components/QuickDesk';
import { getFreeSlotsForServiceDay } from '@/lib/bookingDashboardService';
import { loadWorkLocations } from '@/lib/scheduling/locationsClient';
import { supabase } from '@/lib/supabaseClient';

// FE-08: QuickDesk shows failed loads as errors with a retry and fails closed: no "no free slots",
// no masters it cannot place, no services it cannot check against the master.

const dictionary: Record<string, string> = bookingsRu;
const mockLanguage = { locale: 'ru', t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key };
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => mockLanguage }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));

type Transfers = { rows: Array<{ staff_id: string; branch_id: string; date: string }>; error: string | null; retry: jest.Mock };
type ServiceStaff = { serviceToStaffMap: Map<string, Set<string>> | null; error: boolean; retry: jest.Mock };
const mockTransfersState: Transfers = { rows: [], error: null, retry: jest.fn() };
const mockServiceStaffState: ServiceStaff = { serviceToStaffMap: null, error: false, retry: jest.fn() };
jest.mock('@/app/dashboard/bookings/components/useTemporaryTransfers', () => ({ useTemporaryTransfers: () => mockTransfersState }));
jest.mock('@/app/dashboard/bookings/components/useServiceStaffMap', () => ({ useServiceStaffMap: () => mockServiceStaffState }));
jest.mock('@/app/dashboard/bookings/components/SellVisitPackageModal', () => ({ SellVisitPackageModal: () => null }));
jest.mock('@/lib/bookingDashboardService', () => ({ getFreeSlotsForServiceDay: jest.fn(), createInternalBooking: jest.fn() }));
jest.mock('@/lib/funnelEvents', () => ({ trackFunnelEvent: jest.fn(), getSessionId: () => 'test-session' }));
jest.mock('@/app/dashboard/bookings/notify', () => ({ notify: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/scheduling/locationsClient', () => ({ loadWorkLocations: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }));

const props = {
    bizId: 'biz1', timezone: 'Asia/Bishkek',
    branches: [{ id: 'branch1', name: 'Branch One' }],
    staff: [{ id: 'staff1', branch_id: 'branch1', full_name: 'Staff One' }],
    services: [{ id: 'service1', branch_id: 'branch1', name_ru: 'Service One', duration_min: 60 }],
};
const slot = { staff_id: 'staff1', branch_id: 'branch1', start_at: '2030-10-14T03:00:00Z', end_at: '2030-10-14T04:00:00Z' };
const createButton = () => screen.getByRole('button', { name: 'Создать запись' }) as HTMLButtonElement;
function choose(label: string, value: string) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockTransfersState, { rows: [], error: null });
    Object.assign(mockServiceStaffState, { serviceToStaffMap: new Map([['service1', new Set(['staff1'])]]), error: false });
});

describe('QuickDesk load failures', () => {
    test('a failed slot load is an error with a retry, not "no free slots"', async () => {
        jest.mocked(getFreeSlotsForServiceDay).mockRejectedValueOnce(new Error('synthetic')).mockResolvedValueOnce([slot]);
        render(<QuickDesk {...props} />);
        choose('Филиал', 'branch1'); choose('Дата', '2030-10-14'); choose('Мастер', 'staff1'); choose('Услуга', 'service1');

        expect(await screen.findByText('Не удалось загрузить свободное время')).toBeTruthy();
        expect(screen.queryByText('Нет свободных слотов')).toBeNull();
        expect(createButton().disabled).toBe(true);

        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        await waitFor(() => expect(createButton().disabled).toBe(false));
        expect(screen.getByRole('option', { name: '09:00–10:00' })).toBeTruthy();
        expect(screen.queryByText('Не удалось загрузить свободное время')).toBeNull();
        expect(getFreeSlotsForServiceDay).toHaveBeenCalledTimes(2);
    });

    test('a failed service-staff map offers no services instead of every branch service', () => {
        Object.assign(mockServiceStaffState, { serviceToStaffMap: null, error: true });
        render(<QuickDesk {...props} />);
        choose('Филиал', 'branch1'); choose('Мастер', 'staff1');

        expect(screen.queryByRole('option', { name: /Service One/ })).toBeNull();
        expect(screen.queryByText(bookingsRu['bookings.desk.noServices'])).toBeNull();
        expect(screen.getByText('Не удалось загрузить услуги мастеров')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(mockServiceStaffState.retry).toHaveBeenCalledTimes(1);
    });

    test('failed transfers offer no masters and show a retry', () => {
        mockTransfersState.error = 'synthetic';
        render(<QuickDesk {...props} />);
        choose('Филиал', 'branch1');

        expect(screen.queryByRole('option', { name: 'Staff One' })).toBeNull();
        expect(screen.queryByText(bookingsRu['bookings.desk.noMasters'])).toBeNull();
        expect(screen.getByText('Не удалось загрузить переводы мастеров между филиалами')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(mockTransfersState.retry).toHaveBeenCalledTimes(1);
        expect(createButton().disabled).toBe(true);
    });
});

describe('QuickDesk data hooks expose failures', () => {
    const { useServiceStaffMap } = jest.requireActual<typeof import('@/app/dashboard/bookings/components/useServiceStaffMap')>(
        '@/app/dashboard/bookings/components/useServiceStaffMap');
    const { useTemporaryTransfers } = jest.requireActual<typeof import('@/app/dashboard/bookings/components/useTemporaryTransfers')>(
        '@/app/dashboard/bookings/components/useTemporaryTransfers');

    test('a service-staff read error is an error, and retry reloads the map', async () => {
        const reply = jest.fn()
            .mockResolvedValueOnce({ data: null, error: { message: 'synthetic' } })
            .mockResolvedValueOnce({ data: [{ service_id: 'service1', staff_id: 'staff1', is_active: true }], error: null });
        jest.mocked(supabase.from).mockImplementation(() => ({ select: () => ({ eq: () => ({ in: reply }) }) }) as never);
        const staff = [{ id: 'staff1' }];
        const { result } = renderHook(() => useServiceStaffMap(staff));

        await waitFor(() => expect(result.current.error).toBe(true));
        expect(result.current.serviceToStaffMap).toBeNull();
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.error).toBe(false));
        expect(result.current.serviceToStaffMap?.get('service1')?.has('staff1')).toBe(true);
    });

    test('a failed transfer read is exposed with a retry', async () => {
        jest.mocked(loadWorkLocations).mockRejectedValueOnce(new Error('synthetic'))
            .mockResolvedValueOnce([{ staff_id: 'staff1', branch_id: 'branch2', date_on: '2030-10-14' }]);
        const staff = [{ id: 'staff1', branch_id: 'branch1' }];
        const { result } = renderHook(() => useTemporaryTransfers('biz1', '2030-10-14', staff));

        await waitFor(() => expect(result.current.error).toBe('synthetic'));
        expect(result.current.rows).toEqual([]);
        act(() => result.current.retry());
        await waitFor(() => expect(result.current.error).toBeNull());
        expect(result.current.rows).toEqual([{ staff_id: 'staff1', branch_id: 'branch2', date: '2030-10-14' }]);
    });
});
