jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
import { getBizContextForManagers } from '@/lib/authBiz';
import { BizAccessError } from '@/lib/authDiagnostics';
import { runBranchAdminListHttp } from '@/lib/branchAdminListHttpService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

const branchId = '10000000-0000-4000-8000-000000000001';
const adminUser = '10000000-0000-4000-8000-000000000002';
const bizId = '10000000-0000-4000-8000-000000000003';
const context = (id = branchId) => ({ params: Promise.resolve({ id }) });

let query: { select: jest.Mock; eq: jest.Mock; maybeSingle: jest.Mock };
let callerFrom: jest.Mock;
let admin: { rpc: jest.Mock; from: jest.Mock };
let usersQuery: { select: jest.Mock; in: jest.Mock };

beforeEach(() => {
    jest.clearAllMocks();
    query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: branchId }, error: null }) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    callerFrom = jest.fn().mockReturnValue(query);
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ supabase: { from: callerFrom }, userId: 'caller', bizId });
    usersQuery = { select: jest.fn(), in: jest.fn().mockResolvedValue({ data: [{ id: adminUser, email: 'a@example.invalid', phone: null, full_name: 'Admin' }], error: null }) };
    usersQuery.select.mockReturnValue(usersQuery);
    admin = {
        rpc: jest.fn().mockResolvedValue({ data: [{ user_id: adminUser, source: 'branch_admin' }], error: null }),
        from: jest.fn().mockReturnValue(usersQuery),
    };
    jest.mocked(createSupabaseAdminClient).mockReturnValue(admin as never);
});

test('awaits route params, scopes the branch to the caller business and returns contacts', async () => {
    const response = await runBranchAdminListHttp(context());

    expect(response.status).toBe(200);
    expect(query.eq.mock.calls).toEqual([['id', branchId], ['biz_id', bizId]]);
    expect(admin.rpc).toHaveBeenCalledWith('branch_admins_effective', { p_branch_id: branchId });
    expect(await response.json()).toEqual({
        ok: true,
        items: [{ user_id: adminUser, source: 'branch_admin', email: 'a@example.invalid', phone: null, full_name: 'Admin' }],
    });
});

test('a branch of another business is refused before any privileged lookup', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    expect((await runBranchAdminListHttp(context())).status).toBe(403);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

test('a malformed branch id is rejected', async () => {
    expect((await runBranchAdminListHttp(context('not-a-uuid'))).status).toBe(400);
    expect(callerFrom).not.toHaveBeenCalled();
});

test.each([
    ['NOT_AUTHENTICATED', 401], ['NO_BIZ_ACCESS', 403], ['SERVICE_UNAVAILABLE', 503],
] as const)('auth %s stops before database access', async (code, status) => {
    (getBizContextForManagers as jest.Mock).mockRejectedValue(new BizAccessError(code));

    expect((await runBranchAdminListHttp(context())).status).toBe(status);
    expect(callerFrom).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
});

test('a failed contact lookup is reported, not silently dropped', async () => {
    usersQuery.in.mockResolvedValue({ data: null, error: { message: 'boom' } });

    expect((await runBranchAdminListHttp(context())).status).toBe(503);
});
