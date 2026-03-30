import { getDashboardAnalyticsOverview } from '@/lib/dashboardAnalyticsOverviewService';

describe('dashboardAnalyticsOverviewService', () => {
    test('aggregates overview payload and caches it', async () => {
        const order = jest.fn().mockResolvedValue({
            data: [
                {
                    date: '2026-03-01',
                    home_views: 100,
                    business_page_views: 50,
                    booking_flow_starts: 20,
                    bookings_created: 10,
                    bookings_confirmed_or_paid: 5,
                    promo_bookings: 2,
                    promo_revenue: 500,
                    total_revenue: 2000,
                },
            ],
            error: null,
        });
        const lte = jest.fn().mockReturnValue({ order });
        const gte = jest.fn().mockReturnValue({ lte });
        const eq = jest.fn().mockReturnValue({ gte });
        const select = jest.fn().mockReturnValue({ eq });

        const result = await getDashboardAnalyticsOverview({
            admin: { from: jest.fn().mockReturnValue({ select }) } as never,
            bizId: 'biz-1',
            startDate: '2026-03-01',
            endDate: '2026-03-31',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                summary: {
                    period: { startDate: '2026-03-01', endDate: '2026-03-31' },
                    bookings: { created: 10, confirmedOrPaid: 5 },
                    funnel: {
                        homeViews: 100,
                        businessPageViews: 50,
                        bookingFlowStarts: 20,
                        conversionHomeToBooking: 5,
                    },
                    revenue: {
                        total: 2000,
                        promoBookings: 2,
                        promoRevenue: 500,
                    },
                },
                byDay: [
                    {
                        date: '2026-03-01',
                        homeViews: 100,
                        businessPageViews: 50,
                        bookingFlowStarts: 20,
                        bookingsCreated: 10,
                        bookingsConfirmedOrPaid: 5,
                        promoBookings: 2,
                        promoRevenue: 500,
                        totalRevenue: 2000,
                    },
                ],
            },
        });
    });
});
