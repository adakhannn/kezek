jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
import { getBizContextForManagers } from '@/lib/authBiz';
import { BizAccessError } from '@/lib/authDiagnostics';
import { runBranchAdminChangeHttp } from '@/lib/branchAdminChangeHttpService';

const branchId = '10000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000002';
const bizId = '10000000-0000-4000-8000-000000000003';
const request = (body: unknown = { user_id: userId }) => new Request('http://localhost/dashboard/api/branches/' + branchId + '/admins/add', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});
let from: jest.Mock; let query: { select: jest.Mock; eq: jest.Mock; maybeSingle: jest.Mock }; let rpc: jest.Mock;
beforeEach(() => {
    jest.clearAllMocks();
    query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: branchId }, error: null }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    from = jest.fn().mockReturnValue(query); rpc = jest.fn().mockResolvedValue({ error: null });
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ supabase: { from, rpc }, userId, bizId });
});
test.each(['add', 'remove'] as const)('%s awaits route params and uses the scoped caller session', async action => {
    const response = await runBranchAdminChangeHttp(request(), { params: Promise.resolve({ id: branchId }) }, action);
    expect(response.status).toBe(200);
    expect(query.eq.mock.calls).toEqual([['id', branchId], ['biz_id', bizId]]);
    expect(rpc).toHaveBeenCalledWith(action === 'add' ? 'grant_branch_admin' : 'revoke_branch_admin', { p_branch_id: branchId, p_user_id: userId });
});
test.each([
    ['NOT_AUTHENTICATED', 401], ['NO_BIZ_ACCESS', 403], ['SERVICE_UNAVAILABLE', 503],
] as const)('auth %s stops before database access', async (code, status) => {
    (getBizContextForManagers as jest.Mock).mockRejectedValue(new BizAccessError(code));
    expect((await runBranchAdminChangeHttp(request(), { params: { id: branchId } }, 'add')).status).toBe(status);
    expect(from).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
});
test.each([{}, { user_id: 'invalid' }, { user_id: userId, role: 'super_admin' }, []])('invalid body is rejected before lookup: %j', async body => {
    expect((await runBranchAdminChangeHttp(request(body), { params: { id: branchId } }, 'add')).status).toBe(400);
    expect(from).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
});
test('invalid JSON cannot become a role mutation', async () => {
    const req = new Request('http://localhost/test', { method: 'POST', body: '{' });
    expect((await runBranchAdminChangeHttp(req, { params: { id: branchId } }, 'add')).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
});
test.each([undefined, 'not-a-uuid'])('invalid branch %s is rejected', async id => {
    expect((await runBranchAdminChangeHttp(request(), { params: { id } }, 'remove')).status).toBe(400);
    expect(from).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
});
test.each([
    [{ data: null, error: null }, 403], [{ data: null, error: { message: 'down' } }, 503],
] as const)('foreign/missing or unreadable branch cannot reach mutation', async (result, status) => {
    query.maybeSingle.mockResolvedValue(result);
    expect((await runBranchAdminChangeHttp(request(), { params: { id: branchId } }, 'remove')).status).toBe(status);
    expect(rpc).not.toHaveBeenCalled();
});
test.each([['42501', 403], ['23503', 400], ['XX000', 500]])('SQL failure %s is not success', async (code, status) => {
    rpc.mockResolvedValue({ error: { code, message: 'database detail' } });
    const result = await runBranchAdminChangeHttp(request(), { params: { id: branchId } }, 'add');
    expect(result.status).toBe(status); expect(await result.json()).toMatchObject({ ok: false });
});
