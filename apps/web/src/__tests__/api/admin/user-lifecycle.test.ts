jest.mock('@/lib/adminHttpAccess', () => ({ requireCurrentSuperAdmin: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import { getServiceClient } from '@/lib/supabaseService';
import { POST as suspend } from '@/app/admin/api/users/[id]/suspend/route';
import { POST as remove, DELETE } from '@/app/admin/api/users/[id]/delete/route';

const actor = '10000000-0000-4000-8000-000000000001';
const target = '10000000-0000-4000-8000-000000000002';
const command = '10000000-0000-4000-8000-000000000003';
const context = { params: Promise.resolve({ id: target }) };
const rpc = jest.fn();
const updateUserById = jest.fn();
const deleteUser = jest.fn();
const request = (body = '{"block":true}') => new Request('http://localhost/admin/api/users/test', { method: 'POST', body });
function prepared(action = 'block', completed = false) {
    rpc.mockResolvedValueOnce({ data: { commandId: command, action, completed }, error: null });
}
beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(requireCurrentSuperAdmin).mockResolvedValue({ ok: true, user: { id: actor } } as never);
    jest.mocked(getServiceClient).mockReturnValue({ rpc, auth: { admin: { updateUserById, deleteUser } } } as never);
    updateUserById.mockResolvedValue({ error: null });
    deleteUser.mockResolvedValue({ error: null });
});
test.each(['{}', '{', '{"block":"false"}', '{"block":0}', '{"block":true,"extra":1}', JSON.stringify({ block: true, reason: 'a'.repeat(501) })])('rejects invalid body %s before writes', async body => {
    expect((await suspend(request(body), context)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
});
test('rejects invalid UUID before service client', async () => {
    expect((await remove(request(), { params: { id: 'bad' } })).status).toBe(400);
    expect(getServiceClient).not.toHaveBeenCalled();
});
test.each([401, 403, 503])('preserves authorization failure %i without privileged work', async status => {
    jest.mocked(requireCurrentSuperAdmin).mockResolvedValue({ ok: false, response: new Response(null, { status }) });
    expect((await suspend(request(), context)).status).toBe(status);
    expect(getServiceClient).not.toHaveBeenCalled();
});
test.each([['USER_LIFECYCLE_SELF', 400], ['USER_LIFECYCLE_PROTECTED', 409], ['USER_LIFECYCLE_OWNER', 409], ['USER_LIFECYCLE_PENDING', 409], ['USER_LIFECYCLE_NOT_FOUND', 404], ['USER_LIFECYCLE_FORBIDDEN', 403], ['database private detail', 503]])('maps %s without calling Auth', async (message, status) => {
    rpc.mockResolvedValue({ error: { message } });
    const result = await remove(request(), context);
    expect(result.status).toBe(status);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(await result.text()).not.toContain('database private detail');
});
test.each(['block', 'unblock', 'delete'])('performs %s and requires its durable receipt', async action => {
    prepared(action); rpc.mockResolvedValueOnce({ data: true, error: null });
    const result = await (action === 'delete' ? remove(request(), context) : suspend(request(JSON.stringify({ block: action === 'block', reason: 'review' })), context));
    expect(result.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(1, 'prepare_user_lifecycle', { p_actor_id: actor, p_user_id: target, p_action: action, p_reason: action === 'delete' ? null : 'review' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'read_user_lifecycle', { p_actor_id: actor, p_user_id: target, p_command_id: command });
    if (action === 'delete') expect(deleteUser).toHaveBeenCalledWith(target);
    else expect(updateUserById).toHaveBeenCalledWith(target, { ban_duration: action === 'block' ? '876000h' : 'none', app_metadata: { kezek_lifecycle_command: command } });
    expect(await result.json()).toEqual(action === 'delete' ? { ok: true } : { ok: true, blocked: action === 'block' });
});
test('DELETE uses the same command', () => expect(DELETE).toBe(remove));
test.each(['block', 'delete'])('completed %s retries do not write Auth again', async action => {
    prepared(action, true);
    expect((await (action === 'delete' ? remove(request(), context) : suspend(request(), context))).status).toBe(200);
    expect(updateUserById).not.toHaveBeenCalled(); expect(deleteUser).not.toHaveBeenCalled();
});
test.each([false, null, 'true'])('Auth success without DB confirmation %j is not success', async data => {
    prepared(); rpc.mockResolvedValueOnce({ data, error: null });
    expect((await suspend(request(), context)).status).toBe(503);
});
test.each(['throw', 'returned'])('resolves a %s Auth error using committed receipt', async kind => {
    prepared(); rpc.mockResolvedValueOnce({ data: true, error: null });
    if (kind === 'throw') updateUserById.mockRejectedValue(new Error('response lost'));
    else updateUserById.mockResolvedValue({ error: { message: 'response lost' } });
    expect((await suspend(request(), context)).status).toBe(200);
});
test('fails closed on a failed receipt read', async () => {
    prepared(); rpc.mockResolvedValueOnce({ data: true, error: { message: 'unavailable' } });
    expect((await suspend(request(), context)).status).toBe(503);
});
test('does not send Auth writes for malformed or mismatched prepared state', async () => {
    prepared('delete');
    expect((await suspend(request(), context)).status).toBe(503);
    expect(updateUserById).not.toHaveBeenCalled();
});
