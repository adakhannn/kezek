jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
const user = { id: 'caller', email: 'caller@example.invalid' };
const client = { auth: { getUser: jest.fn() }, rpc: jest.fn(), from: jest.fn() };
beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(createSupabaseServerClient).mockResolvedValue(client as never);
    client.auth.getUser.mockResolvedValue({ data: { user }, error: null });
    client.rpc.mockResolvedValue({ data: true, error: null });
});
test('uses the verified caller session for the canonical RPC before returning its client', async () => {
    expect(await requireCurrentSuperAdmin()).toEqual({ ok: true, user, supabase: client });
    expect(client.rpc).toHaveBeenCalledWith('is_super_admin');
    expect(client.auth.getUser.mock.invocationCallOrder[0]).toBeLessThan(client.rpc.mock.invocationCallOrder[0]);
    expect(client.from).not.toHaveBeenCalled();
});
test.each([{ user: null, error: null }, { user, error: { message: 'invalid session' } }])('denies unverified identity before RPC %p', async auth => {
    client.auth.getUser.mockResolvedValue({ data: { user: auth.user }, error: auth.error });
    const result = await requireCurrentSuperAdmin();
    if (result.ok) throw new Error('Unexpected access');
    expect(result.response.status).toBe(401); expect(client.rpc).not.toHaveBeenCalled();
});
test('SQL false denies access; a service client cannot substitute another identity', async () => {
    client.rpc.mockResolvedValue({ data: false, error: null });
    const result = await requireCurrentSuperAdmin();
    if (result.ok) throw new Error('Unexpected access');
    expect(result.response.status).toBe(403); expect(client.rpc).toHaveBeenCalledWith('is_super_admin');
});
test.each(['resolved', 'thrown', 'malformed'])('fails closed on %s RPC failure', async failure => {
    if (failure === 'thrown') client.rpc.mockRejectedValue(new Error('private database detail'));
    else client.rpc.mockResolvedValue({ data: failure === 'malformed' ? 'true' : true, error: failure === 'resolved' ? { message: 'private database detail' } : null });
    const result = await requireCurrentSuperAdmin();
    if (result.ok) throw new Error('Unexpected access');
    expect(result.response.status).toBe(503); expect(await result.response.text()).not.toContain('private database detail');
});
