jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { runBranchDelete } from '@/lib/branchDeleteService';

describe('branchDeleteService', () => {
    const admin = {
        from: jest.fn(),
    };

    function createTripleEqResultQuery<T>(result: T) {
        const query = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 3 ? Promise.resolve(result) : query;
        });

        return query;
    }

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns validation when branch does not belong to business', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: 'Филиал не принадлежит этому бизнесу',
        });

        const result = await runBranchDelete({
            admin,
            branchId: 'branch-id',
            bizId: 'biz-id',
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 400,
            errorType: 'validation',
            message: 'Филиал не принадлежит этому бизнесу',
        });
    });

    test('returns conflict when branch has active services', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: { id: 'branch-id', biz_id: 'biz-id' },
            error: null,
        });

        admin.from.mockImplementation((table: string) => {
            if (table === 'services') {
                return createTripleEqResultQuery({ count: 1, error: null });
            }
            throw new Error(`Unexpected table: ${table}`);
        });

        const result = await runBranchDelete({
            admin,
            branchId: 'branch-id',
            bizId: 'biz-id',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.errorType).toBe('conflict');
        }
    });
});

