import { runStaffDeleteService } from '@/lib/staffDeleteService';
import { createMockSupabase } from '../api/testHelpers';

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';

describe('staffDeleteService', () => {
    test('deletes staff after cleanup', async () => {
        const admin = createMockSupabase();
        const roleClient = createMockSupabase();

        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: {
                id: 'staff-id',
                biz_id: 'biz-id',
                user_id: 'user-id',
                is_active: true,
                full_name: 'Test Staff',
            },
        });

        admin.from.mockImplementation((table: string) => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockResolvedValue(table === 'bookings' ? { count: 0, error: null } : { error: null }),
            lt: jest.fn().mockResolvedValue({ error: null }),
            delete: jest.fn().mockReturnThis(),
        }));

        roleClient.from.mockImplementation((table: string) => {
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

            return {
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                neq: jest.fn().mockResolvedValue({ error: null }),
                upsert: jest.fn().mockResolvedValue({ error: null }),
            };
        });

        const result = await runStaffDeleteService({
            admin: admin as never,
            roleClient: roleClient as never,
            bizId: 'biz-id',
            staffId: 'staff-id',
        });

        expect(result).toEqual({ ok: true });
    });

    test('blocks deletion when future bookings exist', async () => {
        const admin = createMockSupabase();
        const roleClient = createMockSupabase();

        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: {
                id: 'staff-id',
                biz_id: 'biz-id',
                user_id: null,
                is_active: true,
                full_name: 'Test Staff',
            },
        });

        admin.from.mockImplementation(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            gt: jest.fn().mockResolvedValue({ count: 2, error: null }),
        }));

        const result = await runStaffDeleteService({
            admin: admin as never,
            roleClient: roleClient as never,
            bizId: 'biz-id',
            staffId: 'staff-id',
        });

        expect(result).toEqual({
            ok: false,
            error: 'conflict',
            message: 'Невозможно удалить сотрудника: у него есть будущие активные брони. Сначала отмените все будущие брони.',
            status: 409,
        });
    });
});
