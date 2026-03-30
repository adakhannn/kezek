jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { runStaffUpdateById } from '@/lib/staffUpdateByIdService';

describe('staffUpdateByIdService', () => {
    let admin: any;

    beforeEach(() => {
        jest.clearAllMocks();
        admin = {
            from: jest.fn(),
        };
    });

    test('returns validation error when percentage sum is not 100', async () => {
        (checkResourceBelongsToBiz as jest.Mock)
            .mockResolvedValueOnce({
                data: {
                    id: 'staff-id',
                    biz_id: 'biz-id',
                    branch_id: 'branch-a',
                    percent_master: 50,
                    percent_salon: 50,
                    hourly_rate: null,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: { id: 'branch-a', biz_id: 'biz-id', is_active: true },
                error: null,
            });

        const result = await runStaffUpdateById({
            admin,
            staffId: 'staff-id',
            bizId: 'biz-id',
            userId: 'user-id',
            body: {
                full_name: 'Updated Name',
                branch_id: 'branch-a',
                is_active: true,
                percent_master: 70,
                percent_salon: 20,
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Сумма процентов должна быть равна 100',
        });
    });

    test('updates staff and records finance audit when values change', async () => {
        (checkResourceBelongsToBiz as jest.Mock)
            .mockResolvedValueOnce({
                data: {
                    id: 'staff-id',
                    biz_id: 'biz-id',
                    branch_id: 'branch-a',
                    percent_master: 40,
                    percent_salon: 60,
                    hourly_rate: 2000,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: { id: 'branch-a', biz_id: 'biz-id', is_active: true },
                error: null,
            });

        admin.from
            .mockReturnValueOnce((() => {
                const updateQuery = { update: jest.fn(), eq: jest.fn() };
                updateQuery.update.mockReturnValue(updateQuery);
                updateQuery.eq
                    .mockImplementationOnce(() => updateQuery)
                    .mockResolvedValueOnce({ data: null, error: null });
                return updateQuery;
            })())
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            });

        const result = await runStaffUpdateById({
            admin,
            staffId: 'staff-id',
            bizId: 'biz-id',
            userId: 'user-id',
            body: {
                full_name: 'Updated Name',
                branch_id: 'branch-a',
                is_active: true,
                percent_master: 50,
                percent_salon: 50,
                hourly_rate: 2500,
            },
        });

        expect(result).toEqual({
            ok: true,
            data: {
                transferred: false,
            },
        });
    });

    test('transfers assignment when branch changes', async () => {
        (checkResourceBelongsToBiz as jest.Mock)
            .mockResolvedValueOnce({
                data: {
                    id: 'staff-id',
                    biz_id: 'biz-id',
                    branch_id: 'branch-a',
                    percent_master: null,
                    percent_salon: null,
                    hourly_rate: null,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: { id: 'branch-b', biz_id: 'biz-id', is_active: true },
                error: null,
            });

        admin.from
            .mockReturnValueOnce((() => {
                const updateQuery = { update: jest.fn(), eq: jest.fn() };
                updateQuery.update.mockReturnValue(updateQuery);
                updateQuery.eq
                    .mockImplementationOnce(() => updateQuery)
                    .mockResolvedValueOnce({ data: null, error: null });
                return updateQuery;
            })())
            .mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockResolvedValue({ data: null, error: null }),
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            })
            .mockReturnValueOnce((() => {
                const updateQuery = { update: jest.fn(), eq: jest.fn() };
                updateQuery.update.mockReturnValue(updateQuery);
                updateQuery.eq
                    .mockImplementationOnce(() => updateQuery)
                    .mockResolvedValueOnce({ data: null, error: null });
                return updateQuery;
            })());

        const result = await runStaffUpdateById({
            admin,
            staffId: 'staff-id',
            bizId: 'biz-id',
            userId: 'user-id',
            body: {
                full_name: 'Updated Name',
                branch_id: 'branch-b',
                is_active: true,
            },
        });

        expect(result).toEqual({
            ok: true,
            data: {
                transferred: true,
            },
        });
    });
});

