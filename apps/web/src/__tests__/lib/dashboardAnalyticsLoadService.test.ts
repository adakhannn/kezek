import { getDashboardAnalyticsLoad } from '@/lib/dashboardAnalyticsLoadService';

describe('dashboardAnalyticsLoadService', () => {
    test('maps hourly load rows to payload', async () => {
        const branchEq = jest.fn().mockResolvedValue({
            data: [
                {
                    date: '2026-03-01',
                    hour: 10,
                    bookings_count: 4,
                    promo_bookings_count: 1,
                    staff_count: 2,
                    unique_clients_count: 3,
                },
            ],
            error: null,
        });
        const hourOrder = jest.fn().mockReturnValue({ eq: branchEq });
        const dateOrder = jest.fn().mockReturnValue({ order: hourOrder });
        const lte = jest.fn().mockReturnValue({ order: dateOrder });
        const gte = jest.fn().mockReturnValue({ lte });
        const eq = jest.fn().mockReturnValue({ gte });
        const select = jest.fn().mockReturnValue({ eq });

        const result = await getDashboardAnalyticsLoad({
            admin: { from: jest.fn().mockReturnValue({ select }) } as never,
            bizId: 'biz-1',
            branchId: 'branch-1',
            startDate: '2026-03-01',
            endDate: '2026-03-31',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                bizId: 'biz-1',
                branchId: 'branch-1',
                period: { startDate: '2026-03-01', endDate: '2026-03-31' },
                points: [
                    {
                        date: '2026-03-01',
                        hour: 10,
                        bookingsCount: 4,
                        promoBookingsCount: 1,
                        staffCount: 2,
                        uniqueClientsCount: 3,
                    },
                ],
            },
        });
    });
});
