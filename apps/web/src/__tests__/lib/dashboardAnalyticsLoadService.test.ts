import { getDashboardAnalyticsLoad } from '@/lib/dashboardAnalyticsLoadService';

describe('dashboardAnalyticsLoadService', () => {
    test('maps hourly load rows to payload', async () => {
        const rpc = jest.fn().mockResolvedValue({ data: { rows: [{date: '2026-03-01', branch_id: 'branch-1', hour: 10, bookings_count: 4, promo_bookings_count: 1, staff_count: 2, unique_clients_count: 3}] }, error: null });
        const result = await getDashboardAnalyticsLoad({
            admin: { rpc },
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
