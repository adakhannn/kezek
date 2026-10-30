import { GET } from '@/app/admin/api/funnel-analytics/route';
import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/adminAccess', () => ({ checkCurrentUserIsSuperAdmin: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logDebug: jest.fn() }));

const getUser = jest.fn();
const query = { select: jest.fn(), eq: jest.fn(), gte: jest.fn(), lte: jest.fn(), then: jest.fn() };

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser } } as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    getUser.mockResolvedValue({ data: { user: { id: 'verified-current-user' } }, error: null });
    jest.mocked(checkCurrentUserIsSuperAdmin).mockResolvedValue({ isSuperAdmin: true, error: null });
    for (const method of ['select', 'eq', 'gte', 'lte'] as const) query[method].mockReturnValue(query);
    query.then.mockImplementation((resolve) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve));
    jest.mocked(getServiceClient).mockReturnValue({ from: jest.fn(() => query) } as unknown as ReturnType<typeof getServiceClient>);
});

it('denies a guest before accessing server-only events', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await GET(new Request('http://localhost/admin/api/funnel-analytics'))).status).toBe(401);
    expect(getServiceClient).not.toHaveBeenCalled();
});

it('denies an authenticated non-super-admin without reading events', async () => {
    jest.mocked(checkCurrentUserIsSuperAdmin).mockResolvedValue({ isSuperAdmin: false, error: null });
    expect((await GET(new Request('http://localhost/admin/api/funnel-analytics'))).status).toBe(403);
    expect(checkCurrentUserIsSuperAdmin).toHaveBeenCalledWith(expect.anything(), 'verified-current-user');
    expect(getServiceClient).not.toHaveBeenCalled();
});

it('fails closed when the role lookup fails', async () => {
    jest.mocked(checkCurrentUserIsSuperAdmin).mockResolvedValue({ isSuperAdmin: false, error: new Error('role lookup failed') });
    expect((await GET(new Request('http://localhost/admin/api/funnel-analytics'))).status).toBe(503);
    expect(getServiceClient).not.toHaveBeenCalled();
});

it('loads global statistics for a verified super-admin without business context', async () => {
    const response = await GET(new Request('http://localhost/admin/api/funnel-analytics?source=quickdesk'));
    expect(response.status).toBe(200);
    expect((await response.json()).data.summary).toEqual({ totalViews: 0, totalBookings: 0, overallConversionRate: 0, totalEvents: 0 });
    expect(query.eq).toHaveBeenCalledWith('source', 'quickdesk');
});

it('rejects an invalid source before accessing event storage', async () => {
    expect((await GET(new Request('http://localhost/admin/api/funnel-analytics?source=invalid'))).status).toBe(400);
    expect(getServiceClient).not.toHaveBeenCalled();
});
