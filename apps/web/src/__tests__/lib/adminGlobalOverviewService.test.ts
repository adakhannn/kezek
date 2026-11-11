import { aggregateGlobalOverview, getGlobalOverview } from '@/lib/adminGlobalOverviewService';

test('groups businesses on the same day exactly once and uses ratios of sums, not averages', () => {
  const result = aggregateGlobalOverview([
    { date: '2026-10-02', home_views: 900, bookings_confirmed_or_paid: 9, bookings_created: 10, promo_bookings: 1, promo_revenue: '20.50', total_revenue: '100.25' },
    { date: '2026-10-01', home_views: 100, business_page_views: 20, booking_flow_starts: 10, bookings_confirmed_or_paid: 50, bookings_created: 60, promo_bookings: 2, promo_revenue: '30.25', total_revenue: '200.50' },
    { date: '2026-10-01', home_views: 0, business_page_views: 3, bookings_confirmed_or_paid: 1, bookings_created: 2, promo_bookings: 3, promo_revenue: null, total_revenue: null },
  ], '2026-10-01', '2026-10-02');
  expect(result.byDay.map(d => d.date)).toEqual(['2026-10-01', '2026-10-02']);
  expect(result.byDay[0]).toMatchObject({ homeViews: 100, businessPageViews: 23, bookingsCreated: 62, bookingsConfirmedOrPaid: 51, promoBookings: 5, promoRevenue: 30.25, totalRevenue: 200.5 });
  expect(result.summary).toEqual({ period: { startDate: '2026-10-01', endDate: '2026-10-02' }, bookings: { created: 72, confirmedOrPaid: 60 }, funnel: { homeViews: 1000, businessPageViews: 23, bookingFlowStarts: 10, conversionHomeToBooking: 6 }, revenue: { total: 300.75, promoBookings: 6, promoRevenue: 50.75 } });
});
test('empty data is explicitly empty, finite and zero', () => {
  const result = aggregateGlobalOverview([], '2026-10-01', '2026-10-02');
  expect(result.byDay).toEqual([]); expect(result.scope).toBe('all_businesses');
  expect(result.summary.funnel.conversionHomeToBooking).toBe(0);
});
test.each([NaN, Infinity, 'not numeric'])('rejects invalid numeric input %s rather than reporting zero', value => {
  expect(() => aggregateGlobalOverview([{ date: '2026-10-01', total_revenue: value }], '', '')).toThrow('Non-finite');
});
const day = { date: '2026-10-01', home_views: 0, business_page_views: 0, booking_flow_starts: 0, bookings_created: 1002, bookings_confirmed_or_paid: 0, promo_bookings: 0, promo_revenue: 0, total_revenue: 0 };
test('reads scalar database rollup and fails instead of returning partial totals', async () => {
  const rpc = jest.fn().mockResolvedValue({ data: { rows: [day], activeBusinesses: 1002 }, error: null });
  const result = await getGlobalOverview({ rpc }, '2026-10-01', '2026-10-02');
  expect(result.summary.bookings.created).toBe(1002); expect(result.byDay).toHaveLength(1);
  expect(rpc).toHaveBeenCalledWith('read_analytics_report_snapshot', { p_date_from: '2026-10-01', p_date_to: '2026-10-02', p_biz_id: null, p_branch_id: null, p_kind: 'global' });
  rpc.mockResolvedValue({ data: null, error: { message: 'source unavailable' } });
  await expect(getGlobalOverview({ rpc }, '2026-10-01', '2026-10-02')).rejects.toThrow('source unavailable');
});
test('null query result is an incomplete response, not zero totals', async () => {
  await expect(getGlobalOverview({ rpc: async () => ({ data: null, error: null }) }, '2026-10-01', '2026-10-02')).rejects.toThrow('Incomplete');
});
