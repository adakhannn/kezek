import type { OverviewByDayPoint } from '@/app/admin/analytics/overview/types';
import { readAnalyticsSnapshot } from '@/lib/analyticsReportSnapshot';
import type { ReportClient } from '@/lib/finance/reportSnapshot';

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

export type GlobalOverviewClient = ReportClient;
export async function getGlobalOverview(admin: GlobalOverviewClient, startDate: string, endDate: string) {
  const snapshot = await readAnalyticsSnapshot(admin, { startDate, endDate, kind: 'global' });
  return aggregateGlobalOverview(snapshot.rows, startDate, endDate);
}
