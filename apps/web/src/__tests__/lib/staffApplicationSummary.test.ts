import { loadStaffApplicationSummary } from '@/lib/staffApplicationSummary';
import { isBusinessOwner } from '@/lib/staffApplicationApprovalService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/staffApplicationApprovalService', () => ({ isBusinessOwner: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn() }));

const owner = jest.mocked(isBusinessOwner);
const createAdmin = jest.mocked(createSupabaseAdminClient);
beforeEach(() => jest.resetAllMocks());

function setup(count: number | null, error: unknown = null) {
    const query = { select: jest.fn(), eq: jest.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValueOnce(query).mockReturnValueOnce(query).mockResolvedValueOnce({ count, error });
    const admin = { from: jest.fn().mockReturnValue(query) };
    createAdmin.mockReturnValue(admin as unknown as ReturnType<typeof createSupabaseAdminClient>);
    return { admin, query };
}

test('counts only pending staff applications in selected business after owner check', async () => {
    const { query, admin } = setup(3);
    owner.mockResolvedValue(true);
    expect(await loadStaffApplicationSummary('user', 'biz')).toEqual({ pending: 3 });
    expect(owner).toHaveBeenCalledWith({ admin, userId: 'user', bizId: 'biz' });
    expect(query.eq.mock.calls).toEqual([['biz_id', 'biz'], ['requested_role', 'staff'], ['status', 'pending']]);
    expect(query.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
});
test('does not read applications for non-owners', async () => {
    const { admin } = setup(3);
    owner.mockResolvedValue(false);
    expect(await loadStaffApplicationSummary('user', 'biz')).toBeNull();
    expect(admin.from).not.toHaveBeenCalled();
});
test('distinguishes an unavailable count from zero', async () => {
    setup(null, { code: 'unavailable' });
    owner.mockResolvedValue(true);
    expect(await loadStaffApplicationSummary('user', 'biz')).toEqual({ pending: null });
});
test('returns zero when no requests remain', async () => {
    setup(0);
    owner.mockResolvedValue(true);
    expect(await loadStaffApplicationSummary('user', 'biz')).toEqual({ pending: 0 });
});
