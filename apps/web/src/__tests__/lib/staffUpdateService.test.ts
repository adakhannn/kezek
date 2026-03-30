import { runStaffUpdate } from '@/lib/staffUpdateService';

describe('staffUpdateService', () => {
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
    });

    test('returns forbidden when manager has no allowed role', async () => {
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

        const result = await runStaffUpdate({
            supabase,
            admin,
            staffId: 'staff-id',
            userId: 'user-id',
            bizId: 'biz-id',
            body: {
                full_name: 'Updated Staff',
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

    test('updates staff and links matched user', async () => {
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
                const updateQuery = {
                    update: jest.fn(),
                    eq: jest.fn(),
                };
                updateQuery.update.mockReturnValue(updateQuery);
                updateQuery.eq
                    .mockImplementationOnce(() => updateQuery)
                    .mockResolvedValueOnce({
                        data: null,
                        error: null,
                    });
                return updateQuery;
            }

            return supabase;
        });

        admin.auth.admin.listUsers.mockResolvedValue({
            data: {
                users: [{ id: 'linked-user-id', email: 'test@example.com' }],
            },
            error: null,
        });
        admin.from
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

        const result = await runStaffUpdate({
            supabase,
            admin,
            staffId: 'staff-id',
            userId: 'user-id',
            bizId: 'biz-id',
            body: {
                full_name: 'Updated Staff',
                email: 'test@example.com',
                branch_id: 'branch-id',
                is_active: true,
            },
        });

        expect(result).toEqual({
            ok: true,
            data: {
                user_linked: true,
            },
        });
    });
});

