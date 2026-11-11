import { getDashboardAnalyticsLoad } from '@/lib/dashboardAnalyticsLoadService';
import { getDashboardAnalyticsOverview } from '@/lib/dashboardAnalyticsOverviewService';
import { readAnalyticsSnapshot, readPromotionSnapshot, assertReportRange } from '@/lib/analyticsReportSnapshot';
import { readStaffHistory } from '@/lib/finance/staffHistory';

jest.mock('@/lib/simpleCache', () => ({ getCached: jest.fn(), setCached: jest.fn() }));
const range = { startDate: '2026-11-01', endDate: '2026-11-30' };
const day = { date: '2026-11-01', home_views: 11, business_page_views: 4, booking_flow_starts: 2, bookings_created: 1, bookings_confirmed_or_paid: 1, promo_bookings: 0, promo_revenue: 0, total_revenue: 2.5 };
const client = (data: unknown, error: { message: string } | null = null) => ({ rpc: jest.fn(async () => ({ data, error })), from: jest.fn(() => ({ data: [day, day] })) });

test('hourly load keeps more than 1000 branch buckets even if REST would return only two', async () => {
    const rows = Array.from({ length: 1501 }, (_, i) => ({ date: '2026-11-01', branch_id: 'branch-' + i, hour: 2, bookings_count: i % 7, promo_bookings_count: 0, staff_count: null, unique_clients_count: null }));
    const admin = client({ rows });
    const result = await getDashboardAnalyticsLoad({ admin, bizId: 'biz', ...range });
    expect(result.ok).toBe(true);
    if (result.ok) {
        const data = result.data as { points: Array<{ bookingsCount: number }> };
        expect(data.points).toHaveLength(1501);
        expect(data.points.reduce((sum, point) => sum + point.bookingsCount, 0)).toBe(rows.reduce((sum, row) => sum + row.bookings_count, 0));
    }
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith('read_analytics_report_snapshot', expect.objectContaining({ p_kind: 'hourly', p_biz_id: 'biz', p_branch_id: null }));
});

test('daily snapshot is complete independently of a REST cap smaller than a month', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ ...day, date: '2026-11-' + String(i + 1).padStart(2, '0') }));
    const admin = client({ rows });
    const result = await getDashboardAnalyticsOverview({ admin, bizId: 'biz', ...range });
    expect(result).toMatchObject({ ok: true, data: { summary: { revenue: { total: 75 }, bookings: { created: 30 } } } });
    expect(admin.from).not.toHaveBeenCalled();
});

test.each([getDashboardAnalyticsLoad, getDashboardAnalyticsOverview])('source failure is not successful zero analytics', async service => {
    const result = await service({ admin: client(null, { message: 'dependency unavailable' }), bizId: 'biz', ...range });
    expect(result).toMatchObject({ ok: false, status: 500 });
});
test.each([null, {}, { rows: null }, { rows: [{ ...day, total_revenue: 'NaN' }] }])('incomplete/invalid daily snapshot fails: %p', async data => {
    await expect(readAnalyticsSnapshot(client(data), { ...range, bizId: 'biz', kind: 'daily' })).rejects.toThrow();
});
test.each([['2026-02-30', '2026-03-01'], ['2026-11-30', '2026-11-01'], ['2025-01-01', '2026-11-01'], ['', '2026-01-01']])('invalid or unbounded range %s..%s never reaches SQL', async (startDate, endDate) => {
    const admin = client({ rows: [] });
    const result = await getDashboardAnalyticsOverview({ admin, bizId: 'biz', startDate, endDate });
    expect(result).toMatchObject({ ok: false, status: 400 }); expect(admin.rpc).not.toHaveBeenCalled();
});
test('366 inclusive dates including leap day are accepted', () => expect(() => assertReportRange('2024-01-01', '2024-12-31')).not.toThrow());

test('promotion dependency failure rejects the whole summary/breakdown', async () => {
    await expect(readPromotionSnapshot(client(null, { message: 'bookings unavailable' }), { bizId: 'biz', branchId: 'branch', timezone: 'Asia/Bishkek', ...range })).rejects.toThrow('bookings unavailable');
});
test('staff history preserves all saved amounts without REST traversal or guarantee recomputation', async () => {
    const rows = Array.from({ length: 1205 }, (_, i) => ({ id: 'shift-' + i, shift_date: '2026-01-01', status: 'closed', total_amount: i + 0.25, master_share: i, salon_share: 10, late_minutes: 0, guaranteed_amount: 999, topup_amount: 7 }));
    const admin = client(rows); const history = await readStaffHistory(admin, 'biz', 'staff');
    expect(history).toHaveLength(1205); expect(history.reduce((sum, row) => sum + row.salon_share, 0)).toBe(12050);
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).toHaveBeenCalledWith('read_staff_finance_history', { p_biz_id: 'biz', p_staff_id: 'staff', p_date_from: null, p_date_to: null });
});
test.each([null, [{}], [{ shift_date: '2026-01-01', status: 'closed', total_amount: Infinity }]])('incomplete staff history rejects rather than pretending empty %p', async data => {
    await expect(readStaffHistory(client(data), 'biz', 'staff')).rejects.toThrow();
});
test('history dependency error propagates', async () => {
    await expect(readStaffHistory(client([], { message: 'history unavailable' }), 'biz', 'staff')).rejects.toThrow('history unavailable');
});
