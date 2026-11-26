import { createTranslate } from '../../../i18n';
import { bookingRowActions } from '../../../screens/manage/bookings/BookingRowActions';
import { calendarCsv, groupByStaff } from '../../../screens/manage/bookings/BookingsCalendarTab';
import {
    bookingStatusLabelKey,
    DASHBOARD_BOOKINGS_PAGE_SIZE,
    dashboardBookingsRpcArgs,
    lastPage,
    parseDashboardBookingsPage,
    servicesSummary,
    type BookingsSelection,
} from '../../../screens/manage/bookings/bookingsQuery';
import { dayBoundsInTz } from '../../../screens/manage/opsKit/dates';

const base: BookingsSelection = {
    bizId: 'biz-1',
    statusFilter: 'all',
    branchFilter: 'all',
    preset: null,
    search: '',
    page: 1,
    todayBounds: null,
    currentStaffId: null,
};

describe('dashboardBookingsRpcArgs (the website list read)', () => {
    test('the default list is every booking except cancelled, page 1', () => {
        expect(dashboardBookingsRpcArgs(base)).toEqual({ p_biz_id: 'biz-1', p_status: 'notCancelled', p_limit: 30, p_offset: 0 });
    });

    test('status, branch, trimmed search and the page offset', () => {
        expect(dashboardBookingsRpcArgs({ ...base, statusFilter: 'paid', branchFilter: 'br-1', search: '  Айбек  ', page: 3 })).toEqual({
            p_biz_id: 'biz-1', p_status: 'paid', p_branch_id: 'br-1', p_search: 'Айбек', p_limit: 30, p_offset: 2 * DASHBOARD_BOOKINGS_PAGE_SIZE,
        });
        expect(dashboardBookingsRpcArgs({ ...base, search: 'x'.repeat(150) }).p_search).toHaveLength(100);
        expect(dashboardBookingsRpcArgs({ ...base, page: 0 }).p_offset).toBe(0);
    });

    test('a preset replaces the status: today includes cancelled within the business day', () => {
        const todayBounds = dayBoundsInTz('2026-11-26', 'Asia/Bishkek');
        const args = dashboardBookingsRpcArgs({ ...base, statusFilter: 'paid', preset: 'today', todayBounds });
        expect(args.p_status).toBe('any');
        expect(args.p_start_from).toBe('2026-11-25T18:00:00.000Z');
        expect(args.p_start_before).toBe('2026-11-26T18:00:00.000Z');
    });

    test('my master filters by the own staff row; hold/confirmed is its own status', () => {
        expect(dashboardBookingsRpcArgs({ ...base, preset: 'myStaff', currentStaffId: 'st-1' })).toMatchObject({ p_status: 'any', p_staff_id: 'st-1' });
        expect(dashboardBookingsRpcArgs({ ...base, preset: 'myStaff', currentStaffId: null }).p_staff_id).toBeUndefined();
        expect(dashboardBookingsRpcArgs({ ...base, preset: 'holdConfirmed' }).p_status).toBe('holdConfirmed');
    });

    test('the last page of the total', () => {
        expect(lastPage(0)).toBe(1);
        expect(lastPage(30)).toBe(1);
        expect(lastPage(31)).toBe(2);
    });
});

describe('parseDashboardBookingsPage', () => {
    test('fills the optional fields and rejects a malformed payload', () => {
        const page = parseDashboardBookingsPage({
            total: 1,
            rows: [{ id: 'b-1', status: 'hold', start_at: '2026-11-26T05:00:00Z', end_at: '2026-11-26T05:30:00Z', client_name: null }],
        });
        expect(page.total).toBe(1);
        expect(page.rows[0]).toMatchObject({ branch_id: null, staff_id: null, client_phone: null, service: null, booking_services: [] });
        expect(() => parseDashboardBookingsPage({ total: -1, rows: [] })).toThrow();
        expect(() => parseDashboardBookingsPage({ total: 1, rows: [{ id: 1 }] })).toThrow();
        expect(() => parseDashboardBookingsPage(null)).toThrow();
    });
});

describe('row texts and actions', () => {
    const t = createTranslate('ru');

    test('services with durations and the total, in the app language', () => {
        expect(servicesSummary([
            { duration_min: 30, service: { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: null } },
            { duration_min: 15, service: null },
        ], t)).toBe('Стрижка (30 мин); 15 мин — Всего: 45 мин');
        expect(servicesSummary([{ duration_min: 30, service: { name_ru: 'Стрижка', name_ky: 'Чач кыркуу', name_en: null } }], createTranslate('ky')))
            .toContain('Чач кыркуу (30');
        expect(servicesSummary([], t)).toBeUndefined();
    });

    test('a past paid booking reads as attended, a no-show in short form', () => {
        const now = new Date('2026-11-26T10:00:00Z');
        expect(bookingStatusLabelKey('paid', '2026-11-26T05:00:00Z', now)).toBe('ops.bookings.status.attended');
        expect(bookingStatusLabelKey('paid', '2026-11-27T05:00:00Z', now)).toBe('ops.bookings.status.paid');
        expect(bookingStatusLabelKey('no_show', '2026-11-26T05:00:00Z', now)).toBe('ops.bookings.status.noShowShort');
    });

    test('actions follow the domain rules: confirm a hold, attendance only after the start, no actions when final', () => {
        const now = new Date('2026-11-26T10:00:00Z');
        expect(bookingRowActions('hold', '2026-11-27T05:00:00Z', now)).toEqual(['confirm', 'cancel']);
        expect(bookingRowActions('confirmed', '2026-11-26T05:00:00Z', now)).toEqual(['attended', 'no_show', 'cancel']);
        expect(bookingRowActions('paid', '2026-11-26T05:00:00Z', now)).toEqual([]);
        expect(bookingRowActions('cancelled', '2026-11-27T05:00:00Z', now)).toEqual([]);
    });
});

describe('day calendar', () => {
    const staff = [{ id: 's-1', full_name: 'Азамат', branch_id: 'br-1' }, { id: 's-2', full_name: 'Бек', branch_id: 'br-2' }];
    const items = [
        { id: 'b-2', staff_id: 's-1', start_at: '2026-11-26T09:00:00Z', end_at: '2026-11-26T09:30:00Z', status: 'hold' as const, booking_services: [] },
        { id: 'b-1', staff_id: 's-1', start_at: '2026-11-26T04:00:00Z', end_at: '2026-11-26T04:30:00Z', status: 'confirmed' as const, booking_services: [] },
        { id: 'b-3', staff_id: 's-9', start_at: '2026-11-26T04:00:00Z', end_at: '2026-11-26T04:30:00Z', status: 'confirmed' as const, booking_services: [] },
    ];

    test('groups the shown masters\' bookings in time order', () => {
        const groups = groupByStaff(staff, items);
        expect(groups.map((group) => [group.member.id, group.bookings.map((booking) => booking.id)])).toEqual([['s-1', ['b-1', 'b-2']], ['s-2', []]]);
    });

    test('the CSV has business times and stays formula-safe', () => {
        expect(calendarCsv(items.slice(0, 1), 'Asia/Bishkek')).toBe(
            '"id","staff_id","start_at","end_at","status"\n"b-2","s-1","2026-11-26 15:00","2026-11-26 15:30","hold"',
        );
    });
});
