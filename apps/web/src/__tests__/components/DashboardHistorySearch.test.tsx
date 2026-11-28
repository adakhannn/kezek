/** @jest-environment jsdom */
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

import { BookingsList } from '@/app/dashboard/bookings/components/BookingsList';
import { useDashboardBookingsListController } from '@/app/dashboard/bookings/components/useDashboardBookingsListController';
import { dashboardBookingsRpcArgs, parseDashboardBookingsPage } from '@/lib/dashboardBookingsPage';

type Args = Record<string, unknown> & { p_offset: number };
type Page = { data: unknown; error: unknown };

const calls: Args[] = [];
const staffFilters: Array<[string, unknown]> = [];
let respond: (args: Args) => Promise<Page>;

jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        rpc: jest.fn((_name: string, args: Args) => ({
            abortSignal: () => {
                calls.push(args);
                return respond(args);
            },
        })),
        auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
        from: jest.fn(() => {
            const query = {
                select: () => query,
                eq: (column: string, value: unknown) => {
                    staffFilters.push([column, value]);
                    return query;
                },
                maybeSingle: async () => ({ data: { id: 'staff-1' }, error: null }),
            };
            return query;
        }),
    },
}));
jest.mock('@/lib/bookingDashboardService', () => ({ cancelBooking: jest.fn(), confirmBooking: jest.fn() }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn(), logError: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ locale: 'ru', t: (_key: string, fallback: string) => fallback }) }));
jest.mock('@/app/dashboard/bookings/components/QuickActions', () => ({ QuickActions: () => null }));

const row = (id: string, extra: Record<string, unknown> = {}) => ({
    id, status: 'confirmed', start_at: '2026-11-18T05:00:00Z', end_at: '2026-11-18T06:00:00Z', branch_id: 'branch', staff_id: 'staff',
    client_id: null, client_name: `Client ${id}`, client_phone: null, service: { name_ru: 'Стрижка', name_ky: null, name_en: null },
    staff_name: 'Мастер', booking_services: [], ...extra,
});
const pageOf = (total: number, count: number, prefix = 'r') => ({ data: { total, rows: Array.from({ length: count }, (_, i) => row(`${prefix}${i}`)) }, error: null });
const deferred = () => {
    let resolve!: (value: Page) => void;
    const promise = new Promise<Page>((done) => { resolve = done; });
    return { promise, resolve };
};

function renderController(showError = jest.fn()) {
    return renderHook(() => useDashboardBookingsListController({
        bizId: 'biz', timezone: 'Asia/Bishkek', locale: 'ru', t: (_key, fallback) => fallback ?? _key,
        notify: jest.fn(async () => undefined), showError, showSuccess: jest.fn(),
    }));
}

beforeEach(() => {
    calls.length = 0;
    staffFilters.length = 0;
    respond = async () => pageOf(45, 30);
});
afterEach(() => jest.useRealTimers());

describe('dashboard bookings list (FE-03)', () => {
    test('search reaches the whole history and counts its matches', async () => {
        jest.useFakeTimers();
        const old = row('old-booking', { client_name: 'Айгерим Старая' });
        respond = async (args) => (args.p_search === 'Айгерим' ? { data: { total: 1, rows: [old] }, error: null } : pageOf(45, 30));
        const { result } = renderController();
        await waitFor(() => expect(result.current.list).toHaveLength(30));
        expect(result.current.totalCount).toBe(45);

        act(() => result.current.setSearchQuery(' Айгерим '));
        expect(calls).toHaveLength(1);
        await act(async () => { jest.advanceTimersByTime(300); });
        await waitFor(() => expect(result.current.list.map((item) => item.id)).toEqual(['old-booking']));

        expect(calls.at(-1)).toMatchObject({ p_biz_id: 'biz', p_search: 'Айгерим', p_offset: 0, p_limit: 30, p_status: 'notCancelled' });
        expect(result.current.totalCount).toBe(1);
    });

    test('typing is debounced into one request, clearing reloads at once', async () => {
        jest.useFakeTimers();
        const { result } = renderController();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        for (const text of ['A', 'Al', 'Ali']) {
            act(() => result.current.setSearchQuery(text));
            await act(async () => { jest.advanceTimersByTime(100); });
        }
        await act(async () => { jest.advanceTimersByTime(300); });
        expect(calls.filter((args) => args.p_search)).toEqual([expect.objectContaining({ p_search: 'Ali' })]);

        act(() => result.current.setSearchQuery(''));
        await act(async () => { jest.advanceTimersByTime(0); });
        await waitFor(() => expect(calls.at(-1)).not.toHaveProperty('p_search'));
    });

    test('a filter change on page 3 asks for page 1 only', async () => {
        const { result } = renderController();
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        act(() => result.current.setCurrentPage(3));
        await waitFor(() => expect(calls.at(-1)?.p_offset).toBe(60));
        const before = calls.length;

        act(() => result.current.setStatusFilter('hold'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(calls.slice(before)).toEqual([expect.objectContaining({ p_status: 'hold', p_offset: 0 })]);
        expect(result.current.currentPage).toBe(1);
    });

    test('a stale response never replaces a newer one', async () => {
        const first = deferred();
        const second = deferred();
        respond = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const { result } = renderController();
        act(() => result.current.setStatusFilter('paid'));
        await waitFor(() => expect(calls).toHaveLength(2));

        await act(async () => { second.resolve(pageOf(2, 2, 'paid')); });
        await act(async () => { first.resolve(pageOf(45, 30, 'all')); });

        expect(result.current.list.map((item) => item.id)).toEqual(['paid0', 'paid1']);
        expect(result.current.totalCount).toBe(2);
        expect(result.current.isLoading).toBe(false);
    });

    test('a failed load of another selection is an error, not the old rows; a failed refresh keeps the rows', async () => {
        const showError = jest.fn();
        const { result } = renderController(showError);
        await waitFor(() => expect(result.current.list).toHaveLength(30));

        respond = async () => ({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });
        await act(async () => { await result.current.refresh(); });
        expect(result.current.list).toHaveLength(30);
        expect(result.current.loadFailed).toBe(true);
        expect(showError).toHaveBeenCalledWith('Не удалось загрузить записи');

        act(() => result.current.setBranchFilter('branch-2'));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.list).toEqual([]);
        expect(result.current.loadFailed).toBe(true);
    });

    test('a page past the end goes to the last page', async () => {
        respond = async (args) => (args.p_offset >= 30 ? { data: { total: 30, rows: [] }, error: null } : pageOf(30, 30));
        const { result } = renderController();
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.setCurrentPage(2));
        await waitFor(() => expect(result.current.currentPage).toBe(1));
        await waitFor(() => expect(result.current.list).toHaveLength(30));
    });

    test('"Сегодня" is the business day and "Мой мастер" is this business\'s staff row', async () => {
        jest.useFakeTimers({ now: new Date('2026-11-18T01:00:00Z') });
        const { result } = renderController();
        await waitFor(() => expect(result.current.currentStaffId).toBe('staff-1'));
        expect(staffFilters).toContainEqual(['biz_id', 'biz']);

        act(() => result.current.setActivePreset('today'));
        await waitFor(() => expect(calls.at(-1)).toMatchObject({
            p_status: 'any', p_start_from: '2026-11-17T18:00:00.000Z', p_start_before: '2026-11-18T18:00:00.000Z',
        }));
        act(() => result.current.setActivePreset('myStaff'));
        await waitFor(() => expect(calls.at(-1)).toMatchObject({ p_status: 'any', p_staff_id: 'staff-1' }));
    });
});

describe('dashboard bookings page helpers', () => {
    const base = { bizId: 'biz', statusFilter: 'all', branchFilter: 'all', preset: null, search: '', page: 1, todayBounds: null, currentStaffId: null };

    test('selections map to the function arguments', () => {
        expect(dashboardBookingsRpcArgs(base)).toEqual({ p_biz_id: 'biz', p_status: 'notCancelled', p_limit: 30, p_offset: 0 });
        expect(dashboardBookingsRpcArgs({ ...base, statusFilter: 'active' }).p_status).toBe('confirmed');
        expect(dashboardBookingsRpcArgs({ ...base, statusFilter: 'no_show', branchFilter: 'b-1', page: 3 })).toMatchObject({ p_status: 'no_show', p_branch_id: 'b-1', p_offset: 60 });
        expect(dashboardBookingsRpcArgs({ ...base, statusFilter: 'paid', preset: 'holdConfirmed' }).p_status).toBe('holdConfirmed');
        expect(dashboardBookingsRpcArgs({ ...base, search: `  ${'x'.repeat(150)} ` }).p_search).toHaveLength(100);
        expect(dashboardBookingsRpcArgs({ ...base, page: 0 }).p_offset).toBe(0);
    });

    test('a malformed payload is rejected', () => {
        expect(() => parseDashboardBookingsPage(null)).toThrow('Unexpected dashboard_bookings_page payload');
        expect(() => parseDashboardBookingsPage({ total: 1, rows: [{ id: 1 }] })).toThrow('Unexpected dashboard_bookings_page row');
        expect(parseDashboardBookingsPage({ total: 1, rows: [row('a', { booking_services: undefined })] }).rows[0].booking_services).toEqual([]);
    });
});

describe('BookingsList states', () => {
    const props = { branches: [], onConfirm: jest.fn(), onCancel: jest.fn(), onMarkAttendance: jest.fn(), currentPage: 1, totalCount: 1, onPageChange: jest.fn() };
    const item = { id: 'b-1', status: 'confirmed' as const, start_at: '2026-11-18T05:00:00Z', end_at: '2026-11-18T06:00:00Z', client_name: 'Айгерим' };

    test('rows stay on screen while the next load runs', () => {
        render(<BookingsList {...props} bookings={[item]} isLoading />);
        expect(screen.getAllByText('Айгерим').length).toBeGreaterThan(0);
        expect(screen.queryByText('Загрузка...')).toBeNull();
    });

    test('a failed load is an error with a retry, not "no bookings"', () => {
        const onRetry = jest.fn();
        render(<BookingsList {...props} bookings={[]} isLoading={false} loadFailed onRetry={onRetry} />);
        expect(screen.getByText('Не удалось загрузить записи')).toBeTruthy();
        expect(screen.queryByText('Нет бронирований')).toBeNull();
        fireEvent.click(screen.getByText('Повторить'));
        expect(onRetry).toHaveBeenCalled();
    });
});
