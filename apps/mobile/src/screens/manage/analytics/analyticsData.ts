import type { MobileI18nKey } from '../../../i18n';
import { apiRequest } from '../../../lib/api';
import { addDaysToDate, isValidDateString } from '../opsKit/dates';

/*
 * The website's business analytics (/dashboard/analytics): GET /api/dashboard/analytics/overview
 * (summary and days of business_daily_stats) and GET /api/dashboard/analytics/load (bookings by
 * hour, the only part the branch filter changes).
 */

export type PeriodPreset = '7' | '30' | '90' | 'custom';
export const PERIOD_PRESETS: PeriodPreset[] = ['7', '30', '90', 'custom'];

export type OverviewSummary = {
    period: { startDate: string; endDate: string };
    bookings: { created: number; confirmedOrPaid: number };
    funnel: { homeViews: number; businessPageViews: number; bookingFlowStarts: number; conversionHomeToBooking: number };
    revenue: { total: number; promoBookings: number; promoRevenue: number };
};

export type OverviewByDayPoint = {
    date: string;
    homeViews: number;
    businessPageViews: number;
    bookingFlowStarts: number;
    bookingsCreated: number;
    bookingsConfirmedOrPaid: number;
    promoBookings: number;
    promoRevenue: number;
    totalRevenue: number;
};

export type LoadPoint = { date: string; hour: number; bookingsCount: number; promoBookingsCount: number };

export type AnalyticsData = {
    summary: OverviewSummary;
    byDay: OverviewByDayPoint[];
    load: { period: { startDate: string; endDate: string }; points: LoadPoint[] };
};

/** The first date of a preset ending on `end`: both endpoints include the start and end dates. */
export function presetStart(end: string, days: number): string {
    return addDaysToDate(end, 1 - days);
}

export function presetDays(preset: Exclude<PeriodPreset, 'custom'>): number {
    return preset === '7' ? 7 : preset === '30' ? 30 : 90;
}

/** Why the period cannot be read (the website's analyticsRangeError), or null. */
export function rangeError(start: string, end: string): MobileI18nKey | null {
    if (!start || !end) return 'ops.analytics.dateRequired';
    if (!isValidDateString(start) || !isValidDateString(end)) return 'ops.analytics.dateFormat';
    return start > end ? 'ops.analytics.dateOrder' : null;
}

/** The promo share of the revenue in percent, two decimals, as on the website. */
export function promoShare(summary: OverviewSummary): number {
    const { total, promoRevenue } = summary.revenue;
    if (!(total > 0) || !(promoRevenue > 0)) return 0;
    return Math.round(((promoRevenue / total) * 100 + Number.EPSILON) * 100) / 100;
}

export type HourLoad = { hour: number; total: number; promo: number; intensity: number };

/** Bookings of every hour 0-23 over the period, with the bar share of the busiest hour. */
export function loadByHour(points: LoadPoint[]): HourLoad[] {
    // The website's scale: the largest point, empty points counted as 1, at least 1.
    const maxBookings = Math.max(...points.map((point) => point.bookingsCount || 1), 1);
    return Array.from({ length: 24 }, (_, hour) => {
        const atHour = points.filter((point) => point.hour === hour);
        const total = atHour.reduce((sum, point) => sum + point.bookingsCount, 0);
        const promo = atHour.reduce((sum, point) => sum + point.promoBookingsCount, 0);
        return { hour, total, promo, intensity: total === 0 ? 0 : Math.min(1, total / maxBookings) };
    });
}

type Envelope<T> = { ok?: boolean; data?: T; error?: string };

export async function fetchAnalytics(startDate: string, endDate: string, branchId: string): Promise<AnalyticsData> {
    const period = `startDate=${startDate}&endDate=${endDate}`;
    const [overview, load] = await Promise.all([
        apiRequest<Envelope<{ summary: OverviewSummary; byDay: OverviewByDayPoint[] }>>(`/api/dashboard/analytics/overview?${period}`),
        apiRequest<Envelope<AnalyticsData['load']>>(
            `/api/dashboard/analytics/load?${period}${branchId !== 'all' ? `&branchId=${encodeURIComponent(branchId)}` : ''}`,
        ),
    ]);
    if (!overview?.ok || !overview.data || !Array.isArray(overview.data.byDay)) throw new Error('Overview response without data');
    if (!load?.ok || !load.data || !Array.isArray(load.data.points)) throw new Error('Load response without data');
    return { summary: overview.data.summary, byDay: overview.data.byDay, load: load.data };
}
