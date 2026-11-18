import { BRANCH_HAS_HISTORY_MESSAGE, BRANCH_IN_USE_MESSAGE, runBranchDelete } from '@/lib/branchDeleteService';

jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

describe('branchDeleteService (DB-14)', () => {
    const run = (error: { message: string; code?: string } | null) => {
        const admin = { rpc: jest.fn().mockResolvedValue({ error }) };
        return { admin, result: runBranchDelete({ admin, branchId: 'branch-1', bizId: 'biz-1' }) };
    };

    test('one database command deletes a branch without history', async () => {
        const { admin, result } = run(null);
        await expect(result).resolves.toEqual({ ok: true });
        expect(admin.rpc).toHaveBeenCalledWith('delete_branch_without_history', { p_biz_id: 'biz-1', p_branch_id: 'branch-1' });
    });

    test.each([
        ['BRANCH_NOT_FOUND', { ok: false, statusCode: 400, errorType: 'validation', message: 'Филиал не принадлежит этому бизнесу' }],
        ['BRANCH_IN_USE', { ok: false, statusCode: 409, errorType: 'conflict', message: BRANCH_IN_USE_MESSAGE, details: { code: 'BRANCH_IN_USE' } }],
        ['BRANCH_HAS_HISTORY', { ok: false, statusCode: 409, errorType: 'conflict', message: BRANCH_HAS_HISTORY_MESSAGE, details: { code: 'BRANCH_HAS_HISTORY' } }],
    ])('%s is explained to the user', async (code, expected) => {
        await expect(run({ message: code }).result).resolves.toEqual(expected);
    });

    test('an unexpected failure is a 500 without database text', async () => {
        const outcome = await run({ message: 'deadlock detected on relation 12345', code: '40P01' }).result;
        expect(outcome).toEqual({ ok: false, statusCode: 500, errorType: 'internal', message: 'Не удалось удалить филиал' });
    });
});
