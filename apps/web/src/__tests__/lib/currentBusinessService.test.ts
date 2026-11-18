import { getCurrentBusinessState, setCurrentBusinessState } from '@/lib/currentBusinessService';
import { createMockSupabase } from '../api/testHelpers';

describe('currentBusinessService', () => {
    test('returns current business state for authorized user', async () => {
        const supabase = createMockSupabase();
        const admin = createMockSupabase();

        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
            error: null,
        });

        admin.from.mockImplementation((table: string) => {
            if (table === 'user_current_business') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { biz_id: 'biz-1' },
                    }),
                };
            }

            if (table === 'businesses') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockResolvedValue({
                        data: [{ id: 'biz-1', name: 'Biz One', slug: 'biz-one' }],
                    }),
                    in: jest.fn().mockResolvedValue({
                        data: [{ id: 'biz-2', name: 'Biz Two', slug: 'biz-two' }],
                    }),
                };
            }

            if (table === 'user_roles') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    not: jest.fn().mockResolvedValue({
                        data: [{ biz_id: 'biz-2', role_id: 'role-manager' }],
                    }),
                };
            }

            if (table === 'roles') {
                return {
                    select: jest.fn().mockResolvedValue({
                        data: [{ id: 'role-manager', key: 'manager' }],
                    }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        const result = await getCurrentBusinessState({
            supabase: supabase as never,
            admin: admin as never,
        });

        expect(result).toEqual({
            ok: true,
            data: {
                currentBizId: 'biz-1',
                businesses: [
                    { id: 'biz-1', name: 'Biz One', city: null, slug: 'biz-one' },
                    { id: 'biz-2', name: 'Biz Two', city: null, slug: 'biz-two' },
                ],
            },
        });
    });

    test('sets current business when user has manager access', async () => {
        const supabase = createMockSupabase();
        const admin = createMockSupabase();

        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
            error: null,
        });

        admin.from.mockImplementation((table: string) => {
            if (table === 'businesses') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: 'biz-1', owner_id: 'other-user' },
                    }),
                };
            }

            if (table === 'user_roles') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                };
            }

            if (table === 'roles') {
                return {
                    select: jest.fn().mockResolvedValue({
                        data: [{ id: 'role-manager', key: 'manager' }],
                        error: null,
                    }),
                };
            }

            if (table === 'user_current_business') {
                return {
                    upsert: jest.fn().mockResolvedValue({ error: null }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        const result = await setCurrentBusinessState({
            supabase: supabase as never,
            admin: {
                ...admin,
                from: (table: string) => {
                    if (table === 'user_roles') {
                        let eqCalls = 0;
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockImplementation(function () {
                                eqCalls += 1;
                                if (eqCalls >= 2) {
                                    return Promise.resolve({
                                        data: [{ role_id: 'role-manager' }],
                                    });
                                }
                                return this;
                            }),
                        };
                    }
                    return admin.from(table);
                },
            } as never,
            bizId: 'biz-1',
        });

        expect(result).toEqual({ ok: true });
    });

    // ARCH-06: a failed read is a 500, not "business not found" or "no access".
    test('a failed business read is a server error, not a 404', async () => {
        const supabase = createMockSupabase();
        supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null });
        const admin = {
            from: () => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } }),
            }),
        };

        const result = await setCurrentBusinessState({ supabase: supabase as never, admin: admin as never, bizId: 'biz-1' });

        expect(result).toMatchObject({ ok: false, status: 500, error: 'internal' });
    });

    test('the owner by owner_id may select the business without a role row', async () => {
        const supabase = createMockSupabase();
        supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null });
        const upsert = jest.fn().mockResolvedValue({ error: null });
        const admin = {
            from: (table: string) => {
                if (table === 'businesses') {
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'biz-1', owner_id: 'user-id' }, error: null }),
                    };
                }
                if (table === 'user_current_business') return { upsert };
                throw new Error(`no ${table} read is needed for the owner`);
            },
        };

        await expect(setCurrentBusinessState({ supabase: supabase as never, admin: admin as never, bizId: 'biz-1' }))
            .resolves.toEqual({ ok: true });
        expect(upsert).toHaveBeenCalledWith({ user_id: 'user-id', biz_id: 'biz-1' }, { onConflict: 'user_id' });
    });
});
