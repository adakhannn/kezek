/** @jest-environment node */
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

import { GET } from '@/app/admin/api/businesses/[id]/members/list/route';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

const bizId = '11111111-1111-4111-8111-111111111111';
const rpc = jest.fn();
const from = jest.fn();
const context = (id = bizId) => ({ params: Promise.resolve({ id }) });
const request = () => new Request(`https://example.invalid/admin/api/businesses/${bizId}/members/list`);
const session = (user: { id: string } | null, error: Error | null = null) =>
    jest.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user }, error }) }, rpc, from } as never);

beforeEach(() => jest.resetAllMocks());

test('rejects a malformed business id before touching the session', async () => {
    const response = await GET(request(), context('not-a-uuid'));
    expect(response.status).toBe(400);
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
});

test.each([[null, null], [{ id: 'stale' }, new Error('expired')]] as const)('answers 401 without a valid session (%#)', async (user, error) => {
    session(user, error);
    const response = await GET(request(), context());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: 'auth' });
    expect(rpc).not.toHaveBeenCalled();
});

test('maps members returned by the permission-checking RPC', async () => {
    session({ id: 'owner' });
    rpc.mockResolvedValue({ data: [{ user_id: 'u1', email: 'a@unit.test', phone: null, full_name: 'A', roles: ['owner', 'manager'] }], error: null });
    const response = await GET(request(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, items: [{ user_id: 'u1', email: 'a@unit.test', phone: null, full_name: 'A', roles: ['owner', 'manager'] }] });
    expect(rpc).toHaveBeenCalledWith('members_of_biz', { p_biz_id: bizId });
});

test('a denied RPC is a 403 and never falls back to reading the identity view', async () => {
    session({ id: 'client' });
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'forbidden' } });
    const response = await GET(request(), context());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: 'forbidden' });
    expect(from).not.toHaveBeenCalled();
});

test('other RPC failures do not leak database text', async () => {
    session({ id: 'owner' });
    rpc.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation "secret_internal" does not exist' } });
    const response = await GET(request(), context());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: 'members_unavailable' });
});
