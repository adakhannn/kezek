jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn(async () => ({ bizId: '11111111-1111-4111-8111-111111111111' })) }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/simpleCache', () => ({ getCached: jest.fn(), setCached: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logDebug: jest.fn() }));
import { GET as promotions } from '@/app/admin/api/analytics/promotions/route';
import { GET as load } from '@/app/admin/api/analytics/load/route';
import { getServiceClient } from '@/lib/supabaseService';
const biz = '11111111-1111-4111-8111-111111111111';
const branch = '22222222-2222-4222-8222-222222222222';
const rpc = jest.fn();
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getServiceClient).mockReturnValue({ rpc } as never); });
test('branch-filtered promotion summary and type breakdown use the same scoped snapshot', async () => {
    const summary = { promoBookings: 1205, promoRevenue: 12.5, totalRevenue: 20 };
    const byType = [{ promotionType: 'discount', bookings: 1205, revenue: 12.5, discountGiven: 5 }];
    rpc.mockResolvedValue({ data: { summary, byType, byDay: [] }, error: null });
    const response = await promotions(new Request('http://localhost/admin/api/analytics/promotions?startDate=2026-11-01&endDate=2026-11-01&groupBy=type&branchId=' + branch));
    expect(response.status).toBe(200); expect((await response.json()).data).toMatchObject({ summary, byType });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('read_promotion_analytics_snapshot', expect.objectContaining({ p_biz_id: biz, p_branch_id: branch, p_date_from: '2026-11-01', p_date_to: '2026-11-01' }));
});
test.each([promotions, load])('read dependency failure returns non-success', async handler => {
    rpc.mockResolvedValue({ data: null, error: { message: 'source missing' } });
    expect((await handler(new Request('http://localhost/admin/api/analytics/test?startDate=2026-11-01&endDate=2026-11-01&groupBy=type'))).status).toBe(500);
});
test.each([promotions, load])('rejects cross-business requests before RPC', async handler => {
    expect((await handler(new Request('http://localhost/admin/api/analytics/test?bizId=' + branch))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
});
test.each([promotions, load])('rejects invalid calendar/range before RPC', async handler => {
    expect((await handler(new Request('http://localhost/admin/api/analytics/test?startDate=2026-02-30&endDate=2026-03-05'))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
});
