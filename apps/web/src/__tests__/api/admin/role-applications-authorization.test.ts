jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn(), createSupabaseAdminClient: jest.fn() }));
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { GET } from '@/app/admin/api/role-applications/route';
import { POST } from '@/app/admin/api/role-applications/[id]/status/route';

const rpc = jest.fn();
beforeEach(() => jest.resetAllMocks());
test.each([['list', GET], ['decision', POST]] as const)('%s rejects stale authentication before permission or admin client', async (_label, handler) => {
    jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'stale' } }, error: new Error('expired') }) }, rpc } as never);
    const call = handler as (req: Request, context: unknown) => Promise<Response>;
    const response = await call(new Request('https://example.invalid/admin/api/role-applications', { method: 'POST', body: '{}' }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) });
    expect(response.status).toBe(401); expect(rpc).not.toHaveBeenCalled(); expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});
