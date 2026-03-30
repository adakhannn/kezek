jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { runStaffTransfer } from '@/lib/staffTransferService';

describe('staffTransferService', () => {
    let admin: any;

    beforeEach(() => {
        jest.clearAllMocks();
        admin = {
            from: jest.fn(),
        };
    });

    test('returns validation when target branch is missing', async () => {
        const result = await runStaffTransfer({
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
            body: {
                target_branch_id: '',
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать целевой филиал',
        });
    });

    test('returns forbidden when staff does not belong to business', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: 'Resource not found',
        });

        const result = await runStaffTransfer({
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
            body: {
                target_branch_id: 'target-branch',
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Сотрудник не принадлежит этому бизнесу',
        });
    });

    test('transfers staff to another branch', async () => {
        (checkResourceBelongsToBiz as jest.Mock)
            .mockResolvedValueOnce({
                data: {
                    id: 'staff-id',
                    biz_id: 'biz-id',
                    branch_id: 'current-branch',
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    id: 'target-branch',
                    biz_id: 'biz-id',
                    is_active: true,
                },
                error: null,
            });

        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce((() => {
                const updateQuery = { update: jest.fn(), eq: jest.fn() };
                updateQuery.update.mockReturnValue(updateQuery);
                updateQuery.eq
                    .mockImplementationOnce(() => updateQuery)
                    .mockResolvedValueOnce({
                        data: null,
                        error: null,
                    });
                return updateQuery;
            })());

        const result = await runStaffTransfer({
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
            body: {
                target_branch_id: 'target-branch',
                copy_schedule: false,
            },
        });

        expect(result).toEqual({ ok: true });
    });
});
