/** @jest-environment node */

import { GET } from '@/app/dashboard/api/role-applications/route';
import { getBizContextForManagers } from '@/lib/authBiz';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));

type ReadResult = { data: unknown[] | null; error: { message: string } | null };
function readQuery(result: ReadResult) {
    const query = {
        select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(),
        in: jest.fn(), gt: jest.fn(), is: jest.fn(),
        then: (resolve: (value: ReadResult) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of [query.select, query.eq, query.order, query.limit, query.in, query.gt, query.is]) {
        method.mockReturnValue(query);
    }
    return query;
}
const business = 'unit-current-business';
let results: Record<string, ReadResult>;
let queries: Record<string, ReturnType<typeof readQuery>>;
let from: jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    results = {
        business_role_applications: { data: [], error: null },
        branches: { data: [], error: null },
        application_submission_blocks: { data: [], error: null },
    };
    queries = {};
    from = jest.fn((table: string) => {
        if (!results[table]) throw new Error(`Unexpected unit table: ${table}`);
        const query = readQuery(results[table]);
        queries[table] = query;
        return query;
    });
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: business });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue({ from });
});

// The caller resolver is mocked: these tests prove ordering at THIS route only,
// not real-session authorization, HTTP denial status, RLS, or tenant isolation.
it('does not construct the privileged client when context resolution rejects', async () => {
    const rejection = new Error('unit context denied');
    (getBizContextForManagers as jest.Mock).mockRejectedValue(rejection);
    await expect(GET()).rejects.toBe(rejection);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
});

it('reads only staff applications and active branches for the resolved business', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, items: [], branches: [] });
    expect(getBizContextForManagers).toHaveBeenCalledTimes(1);
    expect(createSupabaseAdminClient).toHaveBeenCalledTimes(1);
    expect(from.mock.calls.map(([table]) => table)).toEqual(['business_role_applications', 'branches']);
    expect(queries.business_role_applications.eq.mock.calls).toEqual([['biz_id', business], ['requested_role', 'staff']]);
    expect(queries.business_role_applications.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(queries.business_role_applications.limit).toHaveBeenCalledWith(100);
    expect(queries.branches.eq.mock.calls).toEqual([['biz_id', business], ['is_active', true]]);
    expect(queries.branches.order).toHaveBeenCalledWith('name', { ascending: true });
});

it('normalizes null successful reads without querying submission blocks', async () => {
    results.business_role_applications.data = null;
    results.branches.data = null;
    const response = await GET();
    expect(await response.json()).toEqual({ ok: true, items: [], branches: [] });
    expect(from).toHaveBeenCalledTimes(2);
});

it('deduplicates applicants and maps only a matching active block while preserving statuses', async () => {
    const items = [
        { id: 'unit-1', applicant_user_id: 'unit-user-a', status: 'pending' },
        { id: 'unit-2', applicant_user_id: 'unit-user-a', status: 'approved' },
        { id: 'unit-3', applicant_user_id: 'unit-user-b', status: 'rejected' },
        { id: 'unit-4', applicant_user_id: null, status: 'cancelled' },
    ];
    const branches = [{ id: 'unit-branch', name: 'UNIT BRANCH', is_active: true }];
    results.business_role_applications.data = items;
    results.branches.data = branches;
    results.application_submission_blocks.data = [{ id: 'unit-block-a', subject_user_id: 'unit-user-a' }];
    const before = Date.now();
    const response = await GET();
    const after = Date.now();
    expect(await response.json()).toEqual({
        ok: true,
        items: items.map((item) => ({ ...item, active_block_id: item.applicant_user_id === 'unit-user-a' ? 'unit-block-a' : null })),
        branches,
    });
    const block = queries.application_submission_blocks;
    expect(block.eq.mock.calls).toEqual([['application_kind', 'staff'], ['biz_id', business]]);
    expect(block.in).toHaveBeenCalledWith('subject_user_id', ['unit-user-a', 'unit-user-b']);
    expect(block.is).toHaveBeenCalledWith('released_at', null);
    expect(block.gt.mock.calls[0][0]).toBe('blocked_until');
    const cutoff = Date.parse(block.gt.mock.calls[0][1] as string);
    expect(cutoff).toBeGreaterThanOrEqual(before);
    expect(cutoff).toBeLessThanOrEqual(after);
    // The mock exposes only read methods; any insert/update/RPC would throw.
    expect(from).toHaveBeenCalledTimes(3);
});

it.each(['business_role_applications', 'branches'])('does not disguise %s read failure as an empty success', async (table) => {
    results[table] = { data: null, error: { message: `unit ${table} error` } };
    const response = await GET();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, message: `unit ${table} error` });
    expect(from).toHaveBeenCalledTimes(2);
});

it('returns the block read failure without sending a successful partial list', async () => {
    results.business_role_applications.data = [{ id: 'unit-a', applicant_user_id: 'unit-user-a' }];
    results.application_submission_blocks = { data: null, error: { message: 'unit block read error' } };
    const response = await GET();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, message: 'unit block read error' });
});

it('maps a successful null block result to no active block', async () => {
    results.business_role_applications.data = [{ id: 'unit-a', applicant_user_id: 'unit-user-a' }];
    results.application_submission_blocks.data = null;
    const response = await GET();
    expect(await response.json()).toEqual({ ok: true, items: [{ id: 'unit-a', applicant_user_id: 'unit-user-a', active_block_id: null }], branches: [] });
});

it('does not turn an unexpected query-construction failure into an empty success', async () => {
    const failure = new Error('unit query construction failed');
    from.mockImplementationOnce(() => { throw failure; });
    await expect(GET()).rejects.toBe(failure);
});
