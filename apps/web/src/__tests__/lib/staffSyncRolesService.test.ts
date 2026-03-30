import { runStaffSyncRoles } from '@/lib/staffSyncRolesService';

describe('staffSyncRolesService', () => {
    test('returns auth error when manager user is missing', async () => {
        const result = await runStaffSyncRoles({
            supabase: {
                auth: {
                    getUser: jest.fn().mockResolvedValue({
                        data: { user: null },
                    }),
                },
                from: jest.fn(),
            } as never,
            admin: { from: jest.fn() } as never,
            bizId: 'biz-1',
        });

        expect(result).toEqual({
            ok: false,
            error: 'auth',
            message: 'Не авторизован',
            status: 401,
        });
    });

    test('returns forbidden when user has no allowed role', async () => {
        const eqBiz = jest.fn().mockResolvedValue({
            data: [],
            error: null,
        });
        const eqUser = jest.fn().mockReturnValue({ eq: eqBiz });
        const select = jest.fn().mockReturnValue({ eq: eqUser });

        const result = await runStaffSyncRoles({
            supabase: {
                auth: {
                    getUser: jest.fn().mockResolvedValue({
                        data: { user: { id: 'user-1' } },
                    }),
                },
                from: jest.fn().mockReturnValue({ select }),
            } as never,
            admin: { from: jest.fn() } as never,
            bizId: 'biz-1',
        });

        expect(result).toEqual({
            ok: false,
            error: 'forbidden',
            message: 'Доступ запрещен',
            status: 403,
        });
    });

    test('syncs missing staff roles and reports totals', async () => {
        const managerRolesEqBiz = jest.fn().mockResolvedValue({
            data: [{ roles: { key: 'owner' } }],
            error: null,
        });
        const managerRolesEqUser = jest.fn().mockReturnValue({ eq: managerRolesEqBiz });
        const managerRolesSelect = jest.fn().mockReturnValue({ eq: managerRolesEqUser });

        const admin = {
            from: jest.fn((table: string) => {
                if (table === 'roles') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                maybeSingle: jest.fn().mockResolvedValue({
                                    data: { id: 'staff-role-id' },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }
                if (table === 'staff') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    not: jest.fn().mockResolvedValue({
                                        data: [
                                            { id: 'staff-1', user_id: 'user-1', full_name: 'Staff 1' },
                                            { id: 'staff-2', user_id: 'user-2', full_name: 'Staff 2' },
                                        ],
                                        error: null,
                                    }),
                                }),
                            }),
                        }),
                    };
                }
                if (table === 'user_roles') {
                    const maybeSingleQueue = [
                        { data: null, error: null },
                        { data: { id: 'existing-role-id' }, error: null },
                    ];
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                eq: jest.fn().mockReturnValue({
                                    eq: jest.fn().mockReturnValue({
                                        maybeSingle: jest.fn().mockImplementation(() => Promise.resolve(maybeSingleQueue.shift())),
                                    }),
                                }),
                            }),
                        }),
                        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
                    };
                }
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        const result = await runStaffSyncRoles({
            supabase: {
                auth: {
                    getUser: jest.fn().mockResolvedValue({
                        data: { user: { id: 'user-id' } },
                    }),
                },
                from: jest.fn().mockReturnValue({ select: managerRolesSelect }),
            } as never,
            admin: admin as never,
            bizId: 'biz-uuid',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                synced: 2,
                total: 2,
                errors: undefined,
            },
        });
    });
});
