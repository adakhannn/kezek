jest.mock('@/lib/staffSchedule', () => ({
    initializeStaffSchedule: jest.fn(),
}));

import { initializeStaffSchedule } from '@/lib/staffSchedule';
import { runStaffCreate } from '@/lib/staffCreateService';

describe('staffCreateService', () => {
    let supabase: any;
    let admin: any;

    beforeEach(() => {
        jest.clearAllMocks();
        supabase = {
            from: jest.fn(),
        };
        admin = {
            auth: {
                admin: {
                    listUsers: jest.fn(),
                },
            },
            from: jest.fn(),
        };
        (initializeStaffSchedule as jest.Mock).mockResolvedValue({
            success: true,
            daysCreated: 14,
        });
    });

    test('returns forbidden when caller has no manager role in business', async () => {
        supabase.from.mockImplementation((table: string) => {
            if (table === 'user_roles') {
                const query = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn(),
                };
                query.eq
                    .mockImplementationOnce(() => query)
                    .mockResolvedValueOnce({
                        data: [],
                        error: null,
                    });
                return query;
            }
            return supabase;
        });

        const result = await runStaffCreate({
            supabase,
            admin,
            userId: 'user-id',
            bizId: 'biz-id',
            body: {
                full_name: 'Test Staff',
                branch_id: 'branch-id',
                is_active: true,
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Доступ запрещен',
        });
    });

    test('creates staff and links existing user when email matches', async () => {
        supabase.from.mockImplementation((table: string) => {
            if (table === 'user_roles') {
                const query = {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn(),
                };
                query.eq
                    .mockImplementationOnce(() => query)
                    .mockResolvedValueOnce({
                        data: [{ roles: { key: 'owner' } }],
                        error: null,
                    });
                return query;
            }

            if (table === 'staff') {
                return {
                    insert: jest.fn().mockReturnThis(),
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: { id: 'staff-id' },
                        error: null,
                    }),
                };
            }

            return supabase;
        });

        admin.auth.admin.listUsers.mockResolvedValue({
            data: {
                users: [
                    { id: 'linked-user-id', email: 'test@example.com', phone: null },
                ],
            },
            error: null,
        });
        admin.from
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'staff-role-id' },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
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
            });

        const result = await runStaffCreate({
            supabase,
            admin,
            userId: 'user-id',
            bizId: 'biz-id',
            body: {
                full_name: 'Test Staff',
                email: 'test@example.com',
                branch_id: 'branch-id',
                is_active: true,
            },
        });

        expect(result).toEqual({
            ok: true,
            data: {
                id: 'staff-id',
                user_linked: true,
                schedule_initialized: true,
                schedule_days_created: 14,
                schedule_error: null,
            },
        });
    });
});
