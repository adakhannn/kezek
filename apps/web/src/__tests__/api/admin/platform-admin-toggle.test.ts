jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
import { POST } from '@/app/admin/api/users/[id]/toggle-super/route';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

const actor = '11111111-1111-4111-8111-111111111111';
const target = '22222222-2222-4222-8222-222222222222';
const caller = { auth: { getUser: jest.fn() }, rpc: jest.fn() };
const admin = { rpc: jest.fn(), from: jest.fn() };
const request = (body: unknown = { makeSuper: true }, id = target) => POST(new Request('https://example.invalid/admin/api/users/' + id + '/toggle-super', {
    method: 'POST', body: JSON.stringify(body),
}), { params: Promise.resolve({ id }) });
beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(createSupabaseServerClient).mockResolvedValue(caller as never);
    jest.mocked(getServiceClient).mockReturnValue(admin as never);
    caller.auth.getUser.mockResolvedValue({ data: { user: { id: actor } }, error: null });
    caller.rpc.mockResolvedValue({ data: true, error: null });
    admin.rpc.mockResolvedValue({ data: true, error: null });
});
test.each([true, false])('one command returns authoritative effective state %p', async enabled => {
    admin.rpc.mockResolvedValue({ data: enabled, error: null });
    const response = await request({ makeSuper: enabled });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { isSuperAdmin: enabled } });
    expect(caller.rpc).toHaveBeenCalledWith('is_super_admin');
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith('set_platform_admin_role', { p_actor_id: actor, p_target_user_id: target, p_enabled: enabled });
    expect(admin.from).not.toHaveBeenCalled();
});
test.each([null, { id: actor }])('invalid session stops before permission or admin work %p', async user => {
    caller.auth.getUser.mockResolvedValue({ data: { user }, error: new Error('expired') });
    expect((await request()).status).toBe(401); expect(caller.rpc).not.toHaveBeenCalled(); expect(getServiceClient).not.toHaveBeenCalled();
});
test('ordinary caller cannot provide another actor', async () => {
    caller.rpc.mockResolvedValue({ data: false, error: null });
    expect((await request({ makeSuper: true, actorId: actor })).status).toBe(403); expect(getServiceClient).not.toHaveBeenCalled();
});
test.each([{}, { makeSuper: 'true' }, { makeSuper: true, actorId: target }])('strict mutation contract %p', async input => {
    expect((await request(input)).status).toBe(400); expect(admin.rpc).not.toHaveBeenCalled();
});
test('invalid target is rejected before privileged client', async () => {
    expect((await request({ makeSuper: true }, 'not-a-uuid')).status).toBe(400); expect(getServiceClient).not.toHaveBeenCalled();
});
test.each([
    ['PLATFORM_ADMIN_LAST_ADMIN', 409], ['PLATFORM_ADMIN_FORBIDDEN', 403], ['PLATFORM_ADMIN_TARGET_NOT_FOUND', 404],
    ['PLATFORM_ADMIN_ROLE_NOT_CONFIGURED', 503], ['private database detail', 503],
])('propagates safe command failure %s as %i', async (message, status) => {
    admin.rpc.mockResolvedValue({ data: true, error: { message } });
    const response = await request(); expect(response.status).toBe(status);
    expect(await response.text()).not.toContain('private database detail'); expect(admin.rpc).toHaveBeenCalledTimes(1);
});
test.each([null, 'true', false, { isSuperAdmin: true }])('unconfirmed result never becomes success %p', async data => {
    admin.rpc.mockResolvedValue({ data, error: null });
    expect((await request()).status).toBe(503); expect(admin.rpc).toHaveBeenCalledTimes(1);
});
