import type { OverviewByDayPoint } from '@/app/admin/analytics/overview/types';

const fields = {
  homeViews: 'home_views', businessPageViews: 'business_page_views', bookingFlowStarts: 'booking_flow_starts',
  bookingsCreated: 'bookings_created', bookingsConfirmedOrPaid: 'bookings_confirmed_or_paid',
  promoBookings: 'promo_bookings', promoRevenue: 'promo_revenue', totalRevenue: 'total_revenue',
} as const;
export type GlobalOverviewRow = { date: string } & Partial<Record<(typeof fields)[keyof typeof fields], number | string | null>>;
const keys = Object.keys(fields) as (keyof typeof fields)[];
function emptyDay(date: string): OverviewByDayPoint {
  return { date, homeViews: 0, businessPageViews: 0, bookingFlowStarts: 0, bookingsCreated: 0, bookingsConfirmedOrPaid: 0, promoBookings: 0, promoRevenue: 0, totalRevenue: 0 };
}

export function aggregateGlobalOverview(rows: GlobalOverviewRow[], startDate: string, endDate: string) {
  const days = new Map<string, OverviewByDayPoint>();
  const totals = emptyDay('');
  for (const row of rows) {
    const day = days.get(row.date) ?? emptyDay(row.date);
    for (const key of keys) {
      const value = Number(row[fields[key]] ?? 0);
      if (!Number.isFinite(value)) throw new Error('Non-finite overview data');
      day[key] += value;
      totals[key] += value;
    }
    days.set(row.date, day);
  }
  return {
    scope: 'all_businesses' as const,
    summary: {
      period: { startDate, endDate },
      bookings: { created: totals.bookingsCreated, confirmedOrPaid: totals.bookingsConfirmedOrPaid },
      funnel: { homeViews: totals.homeViews, businessPageViews: totals.businessPageViews, bookingFlowStarts: totals.bookingFlowStarts,
        conversionHomeToBooking: totals.homeViews > 0 ? Math.round(totals.bookingsConfirmedOrPaid / totals.homeViews * 10_000) / 100 : 0 },
      revenue: { total: totals.totalRevenue, promoBookings: totals.promoBookings, promoRevenue: totals.promoRevenue },
    },
    byDay: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

type StatsQuery = {
  select(columns: string): StatsQuery;
  gte(column: string, value: string): StatsQuery;
  lte(column: string, value: string): StatsQuery;
  order(column: string, options: { ascending: boolean }): StatsQuery;
  range(from: number, to: number): PromiseLike<{ data: GlobalOverviewRow[] | null; error: unknown }>;
};
export type GlobalOverviewClient = { from(table: string): StatsQuery };

export async function getGlobalOverview(admin: GlobalOverviewClient, startDate: string, endDate: string) {
  const rows: GlobalOverviewRow[] = [];
  const size = 1000;
  // Stable primary-key order prevents same-date businesses being lost at page boundaries.
  for (let offset = 0; ; offset += size) {
    const { data, error } = await admin.from('business_daily_stats')
      .select(['date', ...Object.values(fields)].join(','))
      .gte('date', startDate).lte('date', endDate)
      .order('date', { ascending: true }).order('biz_id', { ascending: true })
      .range(offset, offset + size - 1);
    if (error) throw new Error('Failed to load overview analytics');
    rows.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return aggregateGlobalOverview(rows, startDate, endDate);
}
