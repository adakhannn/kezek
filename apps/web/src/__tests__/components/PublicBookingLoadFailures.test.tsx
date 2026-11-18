/** @jest-environment jsdom */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { addDays } from 'date-fns';

import { ServiceSelector } from '@/app/b/[slug]/components/ServiceSelector';
import { SlotPicker } from '@/app/b/[slug]/components/SlotPicker';
import { useBookingSlotsState } from '@/app/b/[slug]/hooks/useBookingSlotsState';
import type { Data } from '@/app/b/[slug]/types';
import BookingForm from '@/app/b/[slug]/view';
import { supabase } from '@/lib/supabaseClient';
import { formatDateInTz } from '@/lib/time';

// FE-08: in the public booking flow a failed load is an error with a retry. It is never
// "this specialist has no services", it does not erase a restored choice, and slots that
// could not be checked against existing bookings are not offered (fail closed).

const mockLanguage = { locale: 'ru', t: (_key: string, fallback?: string) => fallback ?? _key };
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => mockLanguage }));

const mockRouter = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
let mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    useSearchParams: () => mockSearchParams,
    usePathname: () => '/b/test-biz',
}));

type QueryState = { data?: unknown; isLoading: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: jest.Mock };
const mockRefetchServiceStaff = jest.fn();
const mockRefetchClientBookings = jest.fn().mockResolvedValue({ data: 0 });
const serviceStaffRows = [{ service_id: 'svc-1', staff_id: 'staff-1', is_active: true }];
const failedServiceStaff: QueryState = {
    data: undefined, isLoading: false, isError: true, isFetching: false, error: new Error('synthetic'), refetch: mockRefetchServiceStaff,
};
const loadedServiceStaff: QueryState = {
    data: serviceStaffRows, isLoading: false, isError: false, isFetching: false, error: null, refetch: mockRefetchServiceStaff,
};
let mockServiceStaffState: QueryState = failedServiceStaff;
const mockPromotions = { data: [], error: null };
const mockClientBookings = { data: 0, isLoading: false, isError: false, refetch: mockRefetchClientBookings };
jest.mock('@/app/b/[slug]/hooks/useBookingData', () => ({
    useBranchPromotions: () => mockPromotions,
    useClientBookings: () => mockClientBookings,
    useServiceStaff: () => mockServiceStaffState,
}));
const mockTransfers = { temporaryTransfers: [], workingLocations: undefined, loading: false, error: null };
jest.mock('@/app/b/[slug]/hooks/useTemporaryTransfers', () => ({ useTemporaryTransfers: () => mockTransfers }));
const mockViewer = { isAuthed: true };
jest.mock('@/app/b/[slug]/hooks/useBookingViewerMeta', () => ({ useBookingViewerMeta: () => mockViewer }));
jest.mock('@/lib/analyticsTrackEvent', () => ({ trackBookingFlowStep: jest.fn() }));
jest.mock('@/lib/funnelEvents', () => ({ getSessionId: () => 'test-session', trackFunnelEvent: jest.fn() }));
jest.mock('@/lib/performance', () => ({ measurePerformance: (_name: string, run: () => Promise<unknown>) => run() }));
jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(), logWarn: jest.fn(), logError: jest.fn(), maskToken: (value: string) => value, maskUrl: (value: string) => value,
}));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }));

const rpc = supabase.rpc as jest.Mock;
const from = supabase.from as jest.Mock;

const data: Data = {
    biz: { id: 'biz-1', slug: 'test-biz', name: 'Test business', address: 'Address', phones: [], rating_score: null, tz: 'Asia/Bishkek' },
    branches: [{ id: 'branch-1', name: 'Branch one', rating_score: null }],
    services: [{ id: 'svc-1', name_ru: 'Стрижка', duration_min: 60, branch_id: 'branch-1' }],
    staff: [{ id: 'staff-1', full_name: 'Мастер', branch_id: 'branch-1', rating_score: null }],
};
const day = formatDateInTz(addDays(new Date(), 3), 'Asia/Bishkek');

function openRestoredStep(step: number) {
    mockSearchParams = new URLSearchParams(`step=${step}&branch=branch-1&day=${day}&staff=staff-1&service=svc-1`);
    return render(<BookingForm data={data} />);
}

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockServiceStaffState = failedServiceStaff;
    rpc.mockReturnValue(new Promise(() => {}));
});

describe('public booking flow when the service-staff map fails', () => {
    test('the service step shows an error with a retry and keeps the restored service', () => {
        const view = openRestoredStep(4);

        expect(screen.getByText('Не удалось загрузить услуги мастера')).toBeTruthy();
        expect(screen.queryByText('Для этого специалиста нет услуг')).toBeNull();
        // The restored choice is still in the return URL: the failure did not "validate" it away.
        expect(mockRouter.replace).toHaveBeenLastCalledWith(expect.stringContaining('service=svc-1'), { scroll: false });

        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(mockRefetchServiceStaff).toHaveBeenCalledTimes(1);

        mockServiceStaffState = loadedServiceStaff;
        view.rerender(<BookingForm data={data} />);
        expect(screen.queryByText('Не удалось загрузить услуги мастера')).toBeNull();
        expect(screen.getByRole('button', { name: 'Стрижка: Добавлено в визит' }).getAttribute('aria-pressed')).toBe('true');
    });

    test('a retry in progress shows loading, not the error or "no services"', () => {
        mockServiceStaffState = { ...failedServiceStaff, isFetching: true };
        openRestoredStep(4);
        expect(screen.getByText('Загрузка...')).toBeTruthy();
        expect(screen.queryByText('Не удалось загрузить услуги мастера')).toBeNull();
        expect(screen.queryByText('Для этого специалиста нет услуг')).toBeNull();
    });

    test('a restored slot step offers no times and retries the map', () => {
        rpc.mockResolvedValue({ data: [{ staff_id: 'staff-1', branch_id: 'branch-1', start_at: `${day}T06:00:00Z`, end_at: `${day}T07:00:00Z` }], error: null });
        openRestoredStep(5);

        expect(screen.getByText('Не удалось получить свободные слоты')).toBeTruthy();
        expect(screen.getByText('Не удалось загрузить услуги мастера')).toBeTruthy();
        expect(screen.queryAllByTestId('time-slot')).toHaveLength(0);
        expect(screen.queryByText('Свободных слотов пока нет')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(mockRefetchServiceStaff).toHaveBeenCalledTimes(1);
    });
});

describe('ServiceSelector states', () => {
    const props = { services: [], selectedServiceIds: [], onToggle: jest.fn(), staffId: 'staff-1' };

    test('a successful empty list keeps the empty state', () => {
        render(<ServiceSelector {...props} />);
        expect(screen.getByText('Для этого специалиста нет услуг')).toBeTruthy();
    });

    test('a failed load is an error with a retry', () => {
        const onRetry = jest.fn();
        render(<ServiceSelector {...props} error onRetry={onRetry} />);
        expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить услуги мастера');
        expect(screen.queryByText('Для этого специалиста нет услуг')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});

describe('slot list when the existing-bookings filter fails', () => {
    type Params = Parameters<typeof useBookingSlotsState>[0];
    const params: Params = {
        bizId: 'biz-1', branchId: 'branch-1', dayStr: '2030-01-05', serviceId: 'svc-1', serviceIds: ['svc-1'],
        servicesFiltered: [{ id: 'svc-1', name_ru: 'Стрижка', branch_id: 'branch-1', duration_min: 60 }],
        serviceStaff: serviceStaffRows,
        staff: [{ id: 'staff-1', branch_id: 'branch-1', full_name: 'Мастер', rating_score: null }],
        staffForSchedule: [{ id: 'staff-1', branch_id: 'branch-1' }], staffId: 'staff-1',
        t: mockLanguage.t, temporaryTransfers: [],
    };
    const freeSlot = { staff_id: 'staff-1', branch_id: 'branch-1', start_at: '2030-01-05T10:00:00Z', end_at: '2030-01-05T11:00:00Z' };
    const tick = async (ms = 300) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
    function bookingsReply(reply: () => Promise<unknown>) {
        from.mockImplementation(() => {
            const query: Record<string, jest.Mock> = {};
            for (const name of ['select', 'eq', 'not', 'gte']) query[name] = jest.fn(() => query);
            query.lte = jest.fn(reply);
            return query;
        });
    }

    beforeEach(() => { jest.useFakeTimers().setSystemTime(new Date('2030-01-05T00:00:00Z')); });
    afterEach(() => { jest.useRealTimers(); });

    test.each([
        ['returns an error', () => Promise.resolve({ data: null, error: { message: 'synthetic bookings failure' } })],
        ['throws', () => Promise.reject(new Error('synthetic network failure'))],
    ])('shows the slot error with a retry instead of unfiltered slots when the query %s', async (_label, failure) => {
        rpc.mockResolvedValue({ data: [freeSlot], error: null });
        bookingsReply(failure);
        const { result } = renderHook(() => useBookingSlotsState(params));
        await tick();
        await act(async () => {});

        expect(result.current.slots).toEqual([]);
        expect(result.current.slotsLoading).toBe(false);
        expect(result.current.slotsError).toBe('Не удалось проверить, какое время уже занято. Повторите попытку.');

        bookingsReply(() => Promise.resolve({ data: [], error: null }));
        act(() => result.current.refreshSlots());
        await tick();
        await act(async () => {});
        expect(result.current.slotsError).toBeNull();
        expect(result.current.slots).toEqual([freeSlot]);
    });

    test('a failed prerequisite hides slots behind its own error', async () => {
        rpc.mockResolvedValue({ data: [freeSlot], error: null });
        bookingsReply(() => Promise.resolve({ data: [], error: null }));
        const { result } = renderHook(() => useBookingSlotsState({ ...params, prerequisiteError: 'Не удалось загрузить услуги мастера' }));
        await tick();
        await act(async () => {});
        expect(result.current).toMatchObject({ slots: [], slotsLoading: false, hasMore: false, slotsError: 'Не удалось загрузить услуги мастера' });
    });
});

describe('existing-bookings warning when its check fails', () => {
    function renderPicker(overrides: Partial<Parameters<typeof SlotPicker>[0]> = {}) {
        return render(<SlotPicker slots={[]} selectedSlot={null} onSelect={jest.fn()} loading={false} error={null}
            dayStr="2030-01-05" dayLabel="5 января" staffId="staff-1" staff={[]} serviceId="svc-1"
            servicesFiltered={[{ id: 'svc-1' }]} serviceStaff={[]} isAuthed clientBookingsCount={null}
            clientBookingsLoading={false} bookingLoading={false} {...overrides} />);
    }

    test('a signed-in client is told the check failed and can retry it', () => {
        const onRetryClientBookings = jest.fn();
        renderPicker({ clientBookingsFailed: true, onRetryClientBookings });
        expect(screen.getByText('Не удалось проверить ваши записи на этот день')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
        expect(onRetryClientBookings).toHaveBeenCalledTimes(1);
    });

    test('no notice when the check succeeded or for a guest', () => {
        renderPicker();
        expect(screen.queryByText('Не удалось проверить ваши записи на этот день')).toBeNull();
        renderPicker({ isAuthed: false, clientBookingsFailed: true });
        expect(screen.queryByText('Не удалось проверить ваши записи на этот день')).toBeNull();
    });
});
