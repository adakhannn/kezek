import { getCached, setCached } from '@/lib/simpleCache';

type OverviewAdminLike = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: string) => {
                gte: (column: string, value: string) => {
                    lte: (column: string, value: string) => {
                        order: (column: string, options: { ascending: boolean }) => Promise<{
                            data: OverviewRow[] | null;
                            error: { message: string } | null;
                        }>;
                    };
                };
            };
        };
    };
};

type OverviewRow = {
    date: string;
    home_views: number | null;
    business_page_views: number | null;
    booking_flow_starts: number | null;
    bookings_created: number | null;
    bookings_confirmed_or_paid: number | null;
    promo_bookings: number | null;
    promo_revenue: number | null;
    total_revenue: number | null;
};

export async function getDashboardAnalyticsOverview({
    admin,
    bizId,
    startDate,
    endDate,
}: {
    admin: OverviewAdminLike;
    bizId: string;
    startDate: string;
    endDate: string;
}): Promise<
    | { ok: true; data: unknown }
    | { ok: false; error: 'server'; message: string; status: 500 }
> {
    const cacheKey = `dashboard_analytics_overview:${bizId}:${startDate}:${endDate}`;
    const cached = getCached<unknown>(cacheKey);
    if (cached) {
        return { ok: true, data: cached };
    }

    const { data, error } = await admin
        .from('business_daily_stats')
        .select(
            'date,home_views,business_page_views,booking_flow_starts,bookings_created,bookings_confirmed_or_paid,promo_bookings,promo_revenue,total_revenue',
        )
        .eq('biz_id', bizId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (error) {
        return {
            ok: false,
            error: 'server',
            message: 'Failed to load overview analytics',
            status: 500,
        };
    }

    let sumHomeViews = 0;
    let sumBusinessViews = 0;
    let sumStarts = 0;
    let sumCreated = 0;
    let sumConfirmed = 0;
    let sumPromoBookings = 0;
    let sumPromoRevenue = 0;
    let sumTotalRevenue = 0;

    const byDay = (data ?? []).map((row) => {
        const home = row.home_views ?? 0;
        const bizViews = row.business_page_views ?? 0;
        const starts = row.booking_flow_starts ?? 0;
        const created = row.bookings_created ?? 0;
        const confirmed = row.bookings_confirmed_or_paid ?? 0;
        const promoBookings = row.promo_bookings ?? 0;
        const promoRevenue = row.promo_revenue ?? 0;
        const totalRevenue = row.total_revenue ?? 0;

        sumHomeViews += home;
        sumBusinessViews += bizViews;
        sumStarts += starts;
        sumCreated += created;
        sumConfirmed += confirmed;
        sumPromoBookings += promoBookings;
        sumPromoRevenue += promoRevenue;
        sumTotalRevenue += totalRevenue;

        return {
            date: row.date,
            homeViews: home,
            businessPageViews: bizViews,
            bookingFlowStarts: starts,
            bookingsCreated: created,
            bookingsConfirmedOrPaid: confirmed,
            promoBookings,
            promoRevenue,
            totalRevenue,
        };
    });

    const payload = {
        summary: {
            period: { startDate, endDate },
            bookings: {
                created: sumCreated,
                confirmedOrPaid: sumConfirmed,
            },
            funnel: {
                homeViews: sumHomeViews,
                businessPageViews: sumBusinessViews,
                bookingFlowStarts: sumStarts,
                conversionHomeToBooking:
                    sumHomeViews > 0
                        ? Math.round(((sumConfirmed / sumHomeViews) * 100 + Number.EPSILON) * 100) / 100
                        : 0,
            },
            revenue: {
                total: sumTotalRevenue,
                promoBookings: sumPromoBookings,
                promoRevenue: sumPromoRevenue,
            },
        },
        byDay,
    };

    setCached(cacheKey, payload, 60_000);

    return {
        ok: true,
        data: payload,
    };
}
