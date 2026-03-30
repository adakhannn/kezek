jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runStaffDismiss } from '@/lib/staffDismissService';

describe('staffDismissService', () => {
    let admin: any;
    let adminClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        admin = {
            from: jest.fn(),
        };
        adminClient = {
            from: jest.fn(),
        };
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(adminClient);
    });

    test('returns not_found when staff does not belong to business', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: null,
            error: 'Resource not found',
        });

        const result = await runStaffDismiss({
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
        });

        expect(result).toEqual({
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Сотрудник не найден',
        });
    });

    test('returns conflict when staff has future bookings', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: {
                id: 'staff-id',
                biz_id: 'biz-id',
                user_id: 'user-id',
                is_active: true,
                full_name: 'Test Staff',
            },
            error: null,
        });

        admin.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockResolvedValue({
                count: 1,
                error: null,
            }),
        });

        const result = await runStaffDismiss({
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
        });

        expect(result).toEqual({
            ok: false,
            status: 409,
            error: 'conflict',
            message: 'У сотрудника есть будущие брони',
        });
    });

    test('dismisses staff and demotes linked user to client', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: {
                id: 'staff-id',
                biz_id: 'biz-id',
                user_id: 'user-id',
                is_active: true,
                full_name: 'Test Staff',
            },
            error: null,
        });

        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                gt: jest.fn().mockResolvedValue({
                    count: 0,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
            });

        adminClient.from.mockImplementation((table: string) => {
            if (table === 'roles') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: 'client-role-id' },
                        error: null,
                    }),
                };
            }

            if (table === 'user_roles') {
                return {
                    delete: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    neq: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                    upsert: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                };
            }

            return adminClient;
        });

        const result = await runStaffDismiss({
            admin,
            bizId: 'biz-id',
            staffId: 'staff-id',
        });

        expect(result).toEqual({ ok: true });
    });
});
